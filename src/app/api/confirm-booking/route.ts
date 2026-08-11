// src/app/api/confirm-booking/route.ts
import { NextResponse } from "next/server";
import { getRentalPeriodDetails } from "@/lib/booking-pricing";
import { getDeliveryAvailabilitySnapshot } from "@/lib/booking-availability";
import { findBookingConsent, linkBookingConsentsToBooking } from "@/lib/booking-consents";
import { CARD_ON_FILE_CONSENT_VERSION } from "@/lib/booking-terms";
import { createBookingRecord } from "@/lib/booking-records";
import { resolveSelectedDumpster } from "@/lib/booking-product";
import { ensureRentalWindowAvailability } from "@/lib/ensure-rental-window-availability";
import { getCustomerFacingBookingLabel } from "@/lib/identity";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizePhone } from "@/lib/customers";
import { getDumpsterPriceForZip } from "@/lib/pricing";
import { sanitizePlacementDetails, validatePlacementDetails } from "@/lib/placement";
import { attachReorderReference } from "@/lib/reorder.server";
import { supabaseServer } from "@/lib/supabase/server";
import { createCheckoutPayment, linkCheckoutPaymentToBooking } from "@/lib/payments/payment-service";
import {
  saveCustomerPaymentMethod,
  SaveCustomerPaymentMethodError,
} from "@/lib/payments/customer-payment-method-service";
import { getCustomerFacingPaymentFailureMessage } from "@/lib/payments/payment-errors";
import type {
  CheckoutPaymentResult,
  PaymentProvider,
  SaveCustomerPaymentMethodFailureStage,
} from "@/lib/payments/types";
import { isTenantResolutionError } from "@/lib/tenant/resolution";
import { getCurrentTenant } from "@/lib/tenant/server";
import { sendBookingEmails } from "@/lib/email/booking-emails";
import {
  getRetailCalendarClosureForDate,
  getRetailSiteSettingsForTenant,
} from "@/lib/tenant/retail-site-settings";

type ConfirmBody = {
  holdId?: string;
  totalPriceCents?: number;
  totalDollars?: number;
  paymentProvider?: "square";
  paymentMethodToken?: string;
  bookingDraft?: {
    deliveryDate?: string;
    pickupDate?: string;
    pickupMode?: "unspecified" | "date";
    customerFirstName?: string;
    customerLastName?: string;
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
    customerStreet?: string;
    customerCity?: string;
    customerState?: string;
    customerZip?: string;
    placementPreference?: string | null;
    placementDetails?: string | null;
    accessIssues?: string[];
    gateInstructions?: string | null;
    otherConcernDetails?: string | null;
    deliveryPresence?: string | null;
    alternateContactName?: string | null;
    alternateContactPhone?: string | null;
    placementPhotoUrl?: string | null;
    specialDeliveryInstructions?: string | null;
    reorderSourceBookingId?: string | null;
    dumpsterSize?: string | null;
    dumpsterProductId?: string | null;
  };

  // keep backward-compatible flat fields too
  deliveryDate?: string;
  pickupDate?: string;
  pickupMode?: "unspecified" | "date";
  customerFirstName?: string;
  customerLastName?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerStreet?: string;
  customerCity?: string;
  customerState?: string;
  customerZip?: string;
  placementPreference?: string | null;
  placementDetails?: string | null;
  accessIssues?: string[];
  gateInstructions?: string | null;
  otherConcernDetails?: string | null;
  deliveryPresence?: string | null;
  alternateContactName?: string | null;
  alternateContactPhone?: string | null;
  placementPhotoUrl?: string | null;
  specialDeliveryInstructions?: string | null;
  reorderSourceBookingId?: string | null;
  dumpsterSize?: string | null;
  dumpsterProductId?: string | null;
};

function isYMD(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test((s || "").trim());
}

function getCustomerName({
  customerName,
  customerFirstName,
  customerLastName,
}: {
  customerName?: string | null;
  customerFirstName?: string | null;
  customerLastName?: string | null;
}) {
  return (
    (customerName || "").trim() ||
    `${(customerFirstName || "").trim()} ${(customerLastName || "").trim()}`.trim()
  );
}

function withOtherConcernDetails(
  specialDeliveryInstructions: string | null | undefined,
  accessIssues: string[] | undefined,
  otherConcernDetails: string | null | undefined,
) {
  const special = (specialDeliveryInstructions || "").trim();
  const concern = (otherConcernDetails || "").trim();
  const concernLine = accessIssues?.includes("other_concern") && concern ? `Other concern: ${concern}` : "";

  return [special, concernLine].filter(Boolean).join("\n") || null;
}

function sanitizeJsonValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => sanitizeJsonValue(item));
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => {
        if (isSensitivePaymentKey(key)) {
          return [key, "[redacted]"];
        }

        return [key, sanitizeJsonValue(nestedValue)];
      }),
    );
  }
  return value;
}

const CARD_ON_FILE_SAVE_CUSTOMER_WARNING =
  "Booking confirmed, but we could not save a payment method for future charges.";

function isSensitivePaymentKey(key: string) {
  return /token|source|cvv|cvc|cardNumber|card_number|accessToken|access_token|rawProvider|raw_provider|raw/i.test(key);
}

function sanitizeErrorMessage(value: unknown) {
  const message = value instanceof Error ? value.message : typeof value === "string" ? value : "Unknown error.";
  return message.replace(/(?:cnon|ccof|EAAA|sq0[a-z0-9_-]*):[A-Za-z0-9._:-]+/gi, "[redacted]");
}

function getSafeErrorCode(error: unknown, fallback: string) {
  if (error instanceof SaveCustomerPaymentMethodError) return error.safeErrorCode;
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") {
    return error.code;
  }
  return fallback;
}

function getFailureStage(
  error: unknown,
  fallback: SaveCustomerPaymentMethodFailureStage,
) {
  return error instanceof SaveCustomerPaymentMethodError ? error.failureStage : fallback;
}

function getRetryable(error: unknown, fallback: boolean) {
  return error instanceof SaveCustomerPaymentMethodError ? error.retryable : fallback;
}

function getCorrelationId(error: unknown, fallback: string | null) {
  if (error instanceof SaveCustomerPaymentMethodError && error.correlationId) {
    return error.correlationId;
  }

  return fallback;
}

function logConfirmBookingEvent(
  level: "error" | "info" | "warn",
  event: string,
  details: Record<string, unknown>,
) {
  console[level](`[confirm-booking] ${event}`, {
    event,
    ...details,
  });
}

async function createPaymentException(input: {
  businessId: string;
  holdId: string;
  bookingId?: string | null;
  customerId?: string | null;
  checkoutPayment: CheckoutPaymentResult;
  exceptionType?: string;
  failureStage?: SaveCustomerPaymentMethodFailureStage;
  safeErrorCode?: string;
  sanitizedErrorMessage?: string;
  attemptedAt?: string;
  retryable?: boolean;
  correlationId?: string | null;
  failureReason: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  rawContext: unknown;
}) {
  const { error } = await supabaseAdmin.from("payment_exceptions").insert({
    business_id: input.businessId,
    booking_hold_id: input.holdId,
    booking_id: input.bookingId ?? null,
    customer_id: input.customerId ?? null,
    booking_payment_id: input.checkoutPayment.paymentId,
    provider: input.checkoutPayment.paymentProvider,
    provider_environment: input.checkoutPayment.providerEnvironment,
    provider_payment_id: input.checkoutPayment.providerPaymentId,
    amount_cents: input.checkoutPayment.amountCents,
    currency: input.checkoutPayment.currency,
    status: "open",
    exception_type: input.exceptionType ?? "booking_creation_failed_after_payment",
    failure_reason: input.failureReason,
    failure_stage: input.failureStage ?? "unexpected_failure",
    safe_error_code: input.safeErrorCode ?? "UNKNOWN_PAYMENT_EXCEPTION",
    sanitized_error_message: input.sanitizedErrorMessage ?? input.failureReason,
    attempted_at: input.attemptedAt ?? new Date().toISOString(),
    retryable: input.retryable ?? false,
    correlation_id: input.correlationId ?? input.checkoutPayment.idempotencyKey,
    customer_name: input.customerName || null,
    customer_email: input.customerEmail || null,
    customer_phone: input.customerPhone || null,
    raw_context: sanitizeJsonValue(input.rawContext),
  });

  if (error) {
    logConfirmBookingEvent("error", "payment_exception_persist_failed", {
      businessId: input.businessId,
      bookingId: input.bookingId ?? null,
      bookingPaymentId: input.checkoutPayment.paymentId,
      exceptionType: input.exceptionType ?? "booking_creation_failed_after_payment",
      failureStage: input.failureStage ?? "unexpected_failure",
      errorMessage: error.message,
    });
  }
}

async function createCardOnFileSaveException(input: {
  businessId: string;
  holdId: string;
  bookingId: string;
  customerId: string | null;
  checkoutPayment: CheckoutPaymentResult;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  error: unknown;
  fallbackStage: SaveCustomerPaymentMethodFailureStage;
  fallbackCode: string;
  retryable?: boolean;
  correlationId?: string | null;
  context?: Record<string, unknown>;
}) {
  const attemptedAt = new Date().toISOString();
  const failureStage = getFailureStage(input.error, input.fallbackStage);
  const safeErrorCode = getSafeErrorCode(input.error, input.fallbackCode);
  const sanitizedErrorMessage = sanitizeErrorMessage(input.error);
  const retryable = getRetryable(input.error, input.retryable ?? false);
  const correlationId = getCorrelationId(input.error, input.correlationId ?? input.checkoutPayment.idempotencyKey);

  logConfirmBookingEvent("warn", "card_on_file_save_failed", {
    businessId: input.businessId,
    bookingId: input.bookingId,
    customerId: input.customerId,
    bookingPaymentId: input.checkoutPayment.paymentId,
    providerEnvironment: input.checkoutPayment.providerEnvironment,
    failureStage,
    safeErrorCode,
    attemptedAt,
    retryable,
    correlationId,
  });

  await createPaymentException({
    businessId: input.businessId,
    holdId: input.holdId,
    bookingId: input.bookingId,
    customerId: input.customerId,
    checkoutPayment: input.checkoutPayment,
    exceptionType: "card_on_file_save_failed_after_payment",
    failureReason: "Card-on-file authorization was accepted, but the payment method could not be saved.",
    failureStage,
    safeErrorCode,
    sanitizedErrorMessage,
    attemptedAt,
    retryable,
    correlationId,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    customerPhone: input.customerPhone,
    rawContext: {
      bookingId: input.bookingId,
      customerId: input.customerId,
      bookingPaymentId: input.checkoutPayment.paymentId,
      provider: input.checkoutPayment.paymentProvider,
      providerEnvironment: input.checkoutPayment.providerEnvironment,
      failureStage,
      safeErrorCode,
      retryable,
      correlationId,
      ...input.context,
    },
  });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message:
      "POST with either { holdId, bookingDraft: { deliveryDate, pickupDate?, pickupMode?, customerName, customerEmail, customerPhone?, customerStreet, customerCity, customerZip } } or the flat fields { holdId, deliveryDate, pickupDate?, pickupMode?, customerName, customerEmail, customerPhone?, customerStreet, customerCity, customerZip }",
  });
}

export async function POST(req: Request) {
  try {
    const serverSupabase = supabaseServer();
    const tenant = await getCurrentTenant();
    const body = (await req.json().catch(() => ({}))) as ConfirmBody;

    const holdId = (body.holdId || "").trim();
    const draft = body.bookingDraft || {};
    const paymentProvider = (body.paymentProvider ?? "square") as PaymentProvider;
    const paymentMethodToken = body.paymentMethodToken?.trim() || "";
    const totalPriceCents = Number(body.totalPriceCents);
    const fallbackTotalDollars = Number(body.totalDollars);
    const normalizedTotalPriceCents =
      Number.isFinite(totalPriceCents) && totalPriceCents >= 0
        ? Math.round(totalPriceCents)
        : Number.isFinite(fallbackTotalDollars) && fallbackTotalDollars >= 0
        ? Math.round(fallbackTotalDollars * 100)
        : null;

    if (paymentProvider !== "square") {
      return NextResponse.json({ ok: false, error: "Unsupported payment provider." }, { status: 400 });
    }

    if (!paymentMethodToken && normalizedTotalPriceCents == null) {
      return NextResponse.json({ ok: false, error: "Missing/invalid totalPriceCents." }, { status: 400 });
    }

    const deliveryDate = ((draft.deliveryDate ?? body.deliveryDate) || "").trim();
    const pickupDate = ((draft.pickupDate ?? body.pickupDate) || "").trim();
    const pickupMode = (draft.pickupMode ?? body.pickupMode) === "date" ? "date" : "unspecified";

    const customerFirstName = ((draft.customerFirstName ?? body.customerFirstName) || "").trim();
    const customerLastName = ((draft.customerLastName ?? body.customerLastName) || "").trim();
    const customerName = getCustomerName({
      customerName: draft.customerName ?? body.customerName,
      customerFirstName,
      customerLastName,
    });
    const customerEmail = ((draft.customerEmail ?? body.customerEmail) || "").trim();
    const customerPhone = normalizePhone(draft.customerPhone ?? body.customerPhone);
    const customerStreet = ((draft.customerStreet ?? body.customerStreet) || "").trim();
    const customerCity = ((draft.customerCity ?? body.customerCity) || "").trim();
    const customerState = ((draft.customerState ?? body.customerState) || "").trim().toUpperCase();
    const customerZip = ((draft.customerZip ?? body.customerZip) || "").trim();
    const reorderSourceBookingId = ((draft.reorderSourceBookingId ?? body.reorderSourceBookingId) || "").trim();
    const selectedDumpster = resolveSelectedDumpster({
      dumpsterSize: draft.dumpsterSize ?? body.dumpsterSize,
      dumpsterProductId: draft.dumpsterProductId ?? body.dumpsterProductId,
    });
    const accessIssues = draft.accessIssues ?? body.accessIssues ?? [];
    const otherConcernDetails = draft.otherConcernDetails ?? body.otherConcernDetails ?? null;
    const placement = sanitizePlacementDetails({
      placementPreference: draft.placementPreference ?? body.placementPreference ?? null,
      placementDetails: draft.placementDetails ?? body.placementDetails ?? null,
      accessIssues,
      gateInstructions: draft.gateInstructions ?? body.gateInstructions ?? null,
      deliveryPresence: draft.deliveryPresence ?? body.deliveryPresence ?? null,
      alternateContactName: draft.alternateContactName ?? body.alternateContactName ?? null,
      alternateContactPhone: draft.alternateContactPhone ?? body.alternateContactPhone ?? null,
      placementPhotoUrl: draft.placementPhotoUrl ?? body.placementPhotoUrl ?? null,
      specialDeliveryInstructions: withOtherConcernDetails(
        draft.specialDeliveryInstructions ?? body.specialDeliveryInstructions ?? null,
        accessIssues,
        otherConcernDetails,
      ),
    });
    const otherConcernError =
      accessIssues.includes("other_concern") && !(otherConcernDetails || "").trim()
        ? "Please describe the concern."
        : null;
    const placementError = validatePlacementDetails(placement) || otherConcernError;

    if (!holdId) {
      return NextResponse.json({ ok: false, error: "Missing holdId." }, { status: 400 });
    }

    if (!isYMD(deliveryDate)) {
      return NextResponse.json(
        { ok: false, error: "Invalid deliveryDate. Use YYYY-MM-DD." },
        { status: 400 }
      );
    }

    const retailSiteSettings = await getRetailSiteSettingsForTenant(tenant);
    const closure = getRetailCalendarClosureForDate(deliveryDate, retailSiteSettings);
    if (closure.blocked) {
      return NextResponse.json(
        { ok: false, error: closure.label || "That delivery date is blocked." },
        { status: 409 }
      );
    }

    if (customerState && !/^[A-Z]{2}$/.test(customerState)) {
      return NextResponse.json({ ok: false, error: "Use a valid 2-letter state code." }, { status: 400 });
    }

    if (pickupDate && !isYMD(pickupDate)) {
      return NextResponse.json(
        { ok: false, error: "Invalid pickupDate. Use YYYY-MM-DD." },
        { status: 400 }
      );
    }

    if (placementError) {
      return NextResponse.json({ ok: false, error: placementError }, { status: 400 });
    }

    // 1) Atomically "claim" the hold so two requests can't confirm the same hold
    const claim = await supabase
      .from("booking_holds")
      .update({ status: "converting" })
      .eq("id", holdId)
      .eq("business_id", tenant.id)
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString())
      .select("id, delivery_date, expires_at")
      .maybeSingle();

    if (claim.error) {
      return NextResponse.json({ ok: false, error: claim.error.message }, { status: 500 });
    }

    if (!claim.data) {
      return NextResponse.json(
        { ok: false, error: "Hold is not active (expired or already used). Please choose a new date." },
        { status: 409 }
      );
    }

    const pricing = await getDumpsterPriceForZip(
      customerZip,
      selectedDumpster,
      {
        deliveryDate,
        pickupDate,
        pickupMode,
      },
    );

    if (!pricing.serviceable || !pricing.priceQuote) {
      await supabase
        .from("booking_holds")
        .update({ status: "active" })
        .eq("id", holdId)
        .eq("business_id", tenant.id)
        .eq("status", "converting");

      return NextResponse.json(
        { ok: false, error: "We couldn’t calculate pricing for this ZIP. Please review the booking details." },
        { status: 409 },
      );
    }

    if (pricing.rentalValidationError) {
      await supabase
        .from("booking_holds")
        .update({ status: "active" })
        .eq("id", holdId)
        .eq("business_id", tenant.id)
        .eq("status", "converting");

      return NextResponse.json(
        { ok: false, error: pricing.rentalValidationError },
        { status: 409 },
      );
    }

    const rentalPeriod = getRentalPeriodDetails({
      deliveryDate,
      pickupDate,
      pickupMode,
      standardRentalDays: pricing.pricingSettings.standardRentalDays,
      dailyOveragePrice: pricing.pricingSettings.dailyOveragePrice,
      maxRentalDays: pricing.pricingSettings.maxRentalDays,
      allowExtendedRentalAtBooking: pricing.pricingSettings.allowExtendedRentalAtBooking,
    });

    if (rentalPeriod.validationError || rentalPeriod.effectivePickupDate == null) {
      await supabase
        .from("booking_holds")
        .update({ status: "active" })
        .eq("id", holdId)
        .eq("business_id", tenant.id)
        .eq("status", "converting");

      return NextResponse.json(
        { ok: false, error: rentalPeriod.validationError || "Invalid rental period." },
        { status: 409 },
      );
    }

    if (normalizedTotalPriceCents != null && pricing.priceQuote.totalCents !== normalizedTotalPriceCents) {
      await supabase
        .from("booking_holds")
        .update({ status: "active" })
        .eq("id", holdId)
        .eq("business_id", tenant.id)
        .eq("status", "converting");

      return NextResponse.json(
        { ok: false, error: "Pricing changed. Please review the updated total before booking." },
        { status: 409 },
      );
    }

    const effectivePickup = pricing.priceQuote.effectivePickupDate;

    if (!effectivePickup) {
      await supabase
        .from("booking_holds")
        .update({ status: "active" })
        .eq("id", holdId)
        .eq("business_id", tenant.id)
        .eq("status", "converting");

      return NextResponse.json(
        { ok: false, error: "We couldn’t determine the rental duration for this booking." },
        { status: 409 },
      );
    }

    try {
      await ensureRentalWindowAvailability({
        unavailableMessage:
          "That rental window is no longer available. Please choose another delivery date.",
        check: () =>
          getDeliveryAvailabilitySnapshot({
            deliveryDate,
            rpcDays: rentalPeriod.bookedRentalDays ?? pricing.pricingSettings.standardRentalDays,
            dumpsterSize: selectedDumpster.dumpsterSize,
            dumpsterProductId: selectedDumpster.dumpsterProductId,
            pickupDate: effectivePickup,
            excludeHoldIds: [holdId],
            businessId: tenant.id,
            logContext: "api/confirm-booking",
          }),
      });
    } catch (availabilityError) {
      await supabase
        .from("booking_holds")
        .update({ status: "active" })
        .eq("id", holdId)
        .eq("business_id", tenant.id)
        .eq("status", "converting");

      return NextResponse.json(
        {
          ok: false,
          error:
            availabilityError instanceof Error
              ? availabilityError.message
              : "That rental window is no longer available. Please choose another delivery date.",
        },
        { status: 409 },
      );
    }

    let checkoutPayment: CheckoutPaymentResult | null = null;

    if (paymentMethodToken) {
      try {
        checkoutPayment = await createCheckoutPayment({
          businessId: tenant.id,
          bookingHoldId: holdId,
          amountCents: pricing.priceQuote.totalCents,
          currency: "USD",
          paymentProvider,
          paymentMethodToken,
          description: customerName
            ? `Dumpster rental for ${customerName} on ${deliveryDate}`
            : `Dumpster rental on ${deliveryDate}`,
        });
      } catch (paymentError) {
        await supabase
          .from("booking_holds")
          .update({ status: "active" })
          .eq("id", holdId)
          .eq("business_id", tenant.id)
          .eq("status", "converting");

        console.error("[confirm-booking] checkout payment failed before provider result:", paymentError);
        const paymentMessage = getCustomerFacingPaymentFailureMessage({
          failureCode: "TEMPORARY_ERROR",
          failureMessage: paymentError instanceof Error ? paymentError.message : null,
        });

        return NextResponse.json(
          {
            ok: false,
            error: paymentMessage,
            customerMessage: paymentMessage,
          },
          { status: 409 },
        );
      }

      if (!checkoutPayment.ok || checkoutPayment.status !== "paid") {
        await supabase
          .from("booking_holds")
          .update({ status: "active" })
          .eq("id", holdId)
          .eq("business_id", tenant.id)
          .eq("status", "converting");

        const statusCode =
          checkoutPayment.status === "failed" || checkoutPayment.status === "canceled" ? 402 : 409;
        const paymentMessage = getCustomerFacingPaymentFailureMessage({
          failureCode: checkoutPayment.failureCode,
          failureMessage: checkoutPayment.failureMessage,
        });

        return NextResponse.json(
          {
            ok: false,
            error: paymentMessage,
            customerMessage: paymentMessage,
            paymentStatus: checkoutPayment.status,
            failureCode: checkoutPayment.failureCode,
          },
          { status: statusCode },
        );
      }
    }

    let createdBooking;
    try {
      createdBooking = await createBookingRecord({
        supabase: serverSupabase,
        businessId: tenant.id,
        booking: {
          delivery_date: deliveryDate,
          pickup_date: effectivePickup || null,
          pickup_mode: "schedule",
          status: "confirmed",
          total_price_cents: pricing.priceQuote.totalCents,
          dumpster_size: selectedDumpster.dumpsterSize,
          dumpster_product_id: selectedDumpster.dumpsterProductId,
          payment_status: checkoutPayment ? "paid" : undefined,
          paid_at: checkoutPayment ? checkoutPayment.paidAt ?? new Date().toISOString() : null,
          payment_provider: checkoutPayment?.paymentProvider ?? null,
          payment_provider_payment_id: checkoutPayment?.providerPaymentId ?? null,
        },
        identity: {
          customerFirstName,
          customerLastName,
          customerName,
          customerEmail,
          customerPhone,
          customerStreet,
          customerCity,
          customerState,
          customerZip,
        },
        placement: {
          placement_preference: placement.placementPreference,
          placement_details: placement.placementDetails,
          access_issues: placement.accessIssues,
          gate_instructions: placement.gateInstructions,
          delivery_presence: placement.deliveryPresence,
          alternate_contact_name: placement.alternateContactName,
          alternate_contact_phone: placement.alternateContactPhone,
          placement_photo_url: placement.placementPhotoUrl,
          special_delivery_instructions: placement.specialDeliveryInstructions,
        },
        pricing: {
          base_rental_price_cents: pricing.priceQuote.rentalPriceCents,
          included_rental_days: pricing.priceQuote.includedRentalDays,
          rental_duration_days: pricing.priceQuote.rentalDurationDays,
          extra_days: pricing.priceQuote.extraDays,
          daily_overage_price_cents: pricing.priceQuote.dailyOveragePriceCents,
          extra_days_charge_cents: pricing.priceQuote.extraDaysChargeCents,
          subtotal_cents: pricing.priceQuote.subtotalCents,
          taxable_subtotal_cents: pricing.priceQuote.taxableSubtotalCents,
          tax_cents: pricing.priceQuote.salesTaxCents,
          max_rental_days_snapshot: pricing.priceQuote.maxRentalDays,
          allow_extended_rental_at_booking_snapshot:
            pricing.priceQuote.allowExtendedRentalAtBooking,
        },
      });
    } catch (insertError) {
      const failureReason =
        insertError instanceof Error ? insertError.message : "Booking creation failed after payment capture.";

      if (checkoutPayment?.status === "paid") {
        await createPaymentException({
          businessId: tenant.id,
          holdId,
          checkoutPayment,
          failureReason,
          customerName,
          customerEmail,
          customerPhone,
          rawContext: {
            bookingDraft: draft,
            deliveryDate,
            pickupDate,
            pickupMode,
            selectedDumpster,
            pricing: pricing.priceQuote,
            paymentId: checkoutPayment.paymentId,
            providerPaymentId: checkoutPayment.providerPaymentId,
            insertError: failureReason,
          },
        });
      }

      // If booking insert fails, try to revert hold back to active (best-effort)
      await supabase
        .from("booking_holds")
        .update({ status: "active" })
        .eq("id", holdId)
        .eq("business_id", tenant.id)
        .eq("status", "converting");

      return NextResponse.json(
        { ok: false, error: failureReason },
        { status: 500 }
      );
    }

    let paymentLinkWarning: string | null = null;
    let consentLinkWarning: string | null = null;
    let cardOnFileWarning: string | null = null;
    try {
      await linkBookingConsentsToBooking({
        businessId: tenant.id,
        bookingHoldId: holdId,
        bookingId: createdBooking.bookingId,
        customerId: createdBooking.customerId,
      });
    } catch (consentLinkError) {
      consentLinkWarning =
        consentLinkError instanceof Error
          ? consentLinkError.message
          : "Booking was created but consent records could not be linked to the booking.";
      console.error("[confirm-booking] booking consent link failed after booking creation:", {
        bookingId: createdBooking.bookingId,
        holdId,
        customerId: createdBooking.customerId,
        error: consentLinkError,
      });
    }

    if (paymentMethodToken && checkoutPayment?.status === "paid" && checkoutPayment.paymentProvider === "square") {
      if (!createdBooking.customerId) {
        cardOnFileWarning = CARD_ON_FILE_SAVE_CUSTOMER_WARNING;
        await createCardOnFileSaveException({
          businessId: tenant.id,
          holdId,
          bookingId: createdBooking.bookingId,
          customerId: null,
          checkoutPayment,
          customerName,
          customerEmail,
          customerPhone,
          error: new Error("Booking customer was missing after booking creation."),
          fallbackStage: "linking_saved_method_to_customer",
          fallbackCode: "BOOKING_CUSTOMER_MISSING",
          retryable: false,
          context: {
            reason: "booking_customer_missing",
          },
        });
      } else if (!checkoutPayment.providerPaymentId) {
        cardOnFileWarning = CARD_ON_FILE_SAVE_CUSTOMER_WARNING;
        await createCardOnFileSaveException({
          businessId: tenant.id,
          holdId,
          bookingId: createdBooking.bookingId,
          customerId: createdBooking.customerId,
          checkoutPayment,
          customerName,
          customerEmail,
          customerPhone,
          error: new Error("Square payment ID was missing after successful checkout payment."),
          fallbackStage: "saving_square_card",
          fallbackCode: "SQUARE_PAYMENT_ID_MISSING",
          retryable: false,
          context: {
            reason: "square_payment_id_missing",
            bookingPaymentId: checkoutPayment.paymentId,
          },
        });
      } else {
        try {
          const cardOnFileConsent = await findBookingConsent({
            businessId: tenant.id,
            bookingHoldId: holdId,
            consentType: "card_on_file",
            consentVersion: CARD_ON_FILE_CONSENT_VERSION,
          });

          if (!cardOnFileConsent) {
            cardOnFileWarning = CARD_ON_FILE_SAVE_CUSTOMER_WARNING;
            await createCardOnFileSaveException({
              businessId: tenant.id,
              holdId,
              bookingId: createdBooking.bookingId,
              customerId: createdBooking.customerId,
              checkoutPayment,
              customerName,
              customerEmail,
              customerPhone,
              error: new Error("Card-on-file authorization was missing while saving payment method."),
              fallbackStage: "unexpected_failure",
              fallbackCode: "CARD_ON_FILE_CONSENT_MISSING",
              retryable: false,
              correlationId: `cof-card-${createdBooking.bookingId}`,
              context: {
                reason: "card_on_file_consent_missing",
              },
            });
          } else {
            const savedPaymentMethod = await saveCustomerPaymentMethod({
              businessId: tenant.id,
              customerId: createdBooking.customerId,
              provider: "square",
              providerEnvironment: checkoutPayment.providerEnvironment,
              cardSaveSourceId: checkoutPayment.providerPaymentId,
              name: customerName,
              givenName: customerFirstName || null,
              familyName: customerLastName || null,
              email: customerEmail,
              phone: customerPhone,
              address: {
                addressLine1: customerStreet,
                locality: customerCity,
                administrativeDistrictLevel1: customerState,
                postalCode: customerZip,
                country: "US",
              },
              consentText: cardOnFileConsent.consentText,
              consentAcceptedAt: cardOnFileConsent.acceptedAt,
              customerIdempotencyKey: `cof-customer-${createdBooking.customerId}`,
              paymentMethodIdempotencyKey: `cof-card-${createdBooking.bookingId}`,
            });

            logConfirmBookingEvent("info", "card_on_file_saved_after_checkout", {
              bookingId: createdBooking.bookingId,
              holdId,
              customerId: createdBooking.customerId,
              customerProviderAccountId: savedPaymentMethod.customerProviderAccount.id,
              customerPaymentMethodId: savedPaymentMethod.paymentMethod.id,
            });
          }
        } catch (cardOnFileError) {
          cardOnFileWarning = CARD_ON_FILE_SAVE_CUSTOMER_WARNING;
          await createCardOnFileSaveException({
            businessId: tenant.id,
            holdId,
            bookingId: createdBooking.bookingId,
            customerId: createdBooking.customerId,
            checkoutPayment,
            customerName,
            customerEmail,
            customerPhone,
            error: cardOnFileError,
            fallbackStage: "unexpected_failure",
            fallbackCode: "CARD_ON_FILE_SAVE_FAILED",
            retryable: true,
            correlationId: `cof-card-${createdBooking.bookingId}`,
          });
        }
      }
    }

    if (checkoutPayment) {
      try {
        await linkCheckoutPaymentToBooking(checkoutPayment.paymentId, createdBooking.bookingId);
      } catch (paymentLinkError) {
        paymentLinkWarning =
          paymentLinkError instanceof Error
            ? paymentLinkError.message
            : "Payment was captured but could not be linked to the booking record.";
        console.error("booking payment link failed after confirm-booking:", paymentLinkError);
      }
    }

    let reorderReferenceSkipped = false;
    let reorderReferencePersisted = false;

    try {
      const reorderReferenceResult = await attachReorderReference(
        serverSupabase,
        createdBooking.bookingId,
        reorderSourceBookingId,
        tenant.id,
      );
      reorderReferenceSkipped = reorderReferenceResult.skipped;

      console.info("[confirm-booking] reorder reference attempt", {
        incomingReorderSourceBookingId: reorderSourceBookingId || null,
        insertedBookingId: createdBooking.bookingId,
        clientType: "service_role",
        result: reorderReferenceResult,
      });
    } catch (reorderReferenceError) {
      console.error("reorder reference write failed after confirm-booking:", reorderReferenceError);
    }

    let persistedReorderReference: string | null = null;

    try {
      const verification = await serverSupabase
        .from("bookings")
        .select("id, reordered_from_booking_id")
        .eq("id", createdBooking.bookingId)
        .eq("business_id", tenant.id)
        .maybeSingle();

      if (verification.error) {
        console.error("[confirm-booking] reorder reference verification failed:", verification.error);
      } else {
        persistedReorderReference = verification.data?.reordered_from_booking_id ?? null;
        reorderReferencePersisted = !!persistedReorderReference;

        console.info("[confirm-booking] reorder reference verification", {
          incomingReorderSourceBookingId: reorderSourceBookingId || null,
          insertedBookingId: createdBooking.bookingId,
          persistedReorderedFromBookingId: persistedReorderReference,
        });
      }
    } catch (verificationError) {
      console.error("[confirm-booking] reorder reference verification threw:", verificationError);
    }

    const ev = await serverSupabase.from("booking_events").insert({
      business_id: tenant.id,
      booking_id: createdBooking.bookingId,
      type: "status_change",
      old_status: "pending",
      new_status: "confirmed",
      note: `Hold ${holdId} converted`,
    });

    if (ev.error) console.error("booking_events insert failed:", ev.error);

        let bookingEmailWarning: string | null = null;

    const serviceAddress = [
      customerStreet,
      customerCity,
      customerState,
      customerZip,
    ]
      .filter(Boolean)
      .join(", ");

    try {
      await sendBookingEmails({
        bookingId: getCustomerFacingBookingLabel(createdBooking.bookingRef),
        customerName,
        customerEmail,
        customerPhone,
        dumpsterSize: selectedDumpster.dumpsterSize,
        deliveryDate,
        pickupDate: pickupMode === "date" ? pickupDate : null,
        serviceAddress,
        totalPriceCents: pricing.priceQuote.totalCents,
      });

      const msg = await supabase
        .from("booking_messages")
        .insert({
          business_id: tenant.id,
          booking_id: createdBooking.bookingId,
          channel: "email",
          direction: "outbound",
          template: "booking_confirmed",
          to: customerEmail || null,
          subject: "Your dumpster rental is confirmed",
          body: `Booking confirmed for ${deliveryDate}. Booking reference: ${getCustomerFacingBookingLabel(
            createdBooking.bookingRef,
          )}.`,
          provider: "amazon_ses",
          status: "sent",
        })
        .select("id")
        .single();

      if (msg.error) console.error("booking_messages insert failed:", msg.error);
    } catch (bookingEmailError) {
      bookingEmailWarning =
        bookingEmailError instanceof Error
          ? bookingEmailError.message
          : "Booking was created, but one or more emails could not be sent.";

      console.error("[confirm-booking] booking email send failed:", {
        bookingId: createdBooking.bookingId,
        bookingRef: createdBooking.bookingRef,
        customerEmail: customerEmail || null,
        error: bookingEmailError,
      });

      const msg = await supabase
        .from("booking_messages")
        .insert({
          business_id: tenant.id,
          booking_id: createdBooking.bookingId,
          channel: "email",
          direction: "outbound",
          template: "booking_confirmed",
          to: customerEmail || null,
          subject: "Your dumpster rental is confirmed",
          body: `Booking confirmed for ${deliveryDate}. Booking reference: ${getCustomerFacingBookingLabel(
            createdBooking.bookingRef,
          )}.`,
          provider: "amazon_ses",
          status: "failed",
        })
        .select("id")
        .single();

      if (msg.error) console.error("booking_messages insert failed:", msg.error);
    }

    // 3) Mark hold as converted (best-effort)
    const finalize = await supabase
      .from("booking_holds")
      .update({ status: "converted" })
      .eq("id", holdId)
      .eq("business_id", tenant.id)
      .eq("status", "converting");

    if (finalize.error) {
      return NextResponse.json(
        {
          ok: true,
          bookingId: createdBooking.bookingId,
          bookingRef: createdBooking.bookingRef,
          customerEmail: customerEmail || null,
          warning:
            paymentLinkWarning ||
            consentLinkWarning ||
            cardOnFileWarning ||
            bookingEmailWarning ||
            "Booking created, but hold status failed to finalize.",
        },
        { status: 200 }
      );
    }

    return NextResponse.json({
      ok: true,
      bookingId: createdBooking.bookingId,
      bookingRef: createdBooking.bookingRef,
      customerEmail: customerEmail || null,
      placementPersistenceSkipped: createdBooking.placementPersistenceSkipped,
      reorderReferenceSkipped,
      reorderReferencePersisted,
      paymentId: checkoutPayment?.paymentId,
      warning:
        paymentLinkWarning ??
        consentLinkWarning ??
        cardOnFileWarning ??
        (createdBooking.placementPersistenceSkipped
          ? "Placement details were collected but could not be persisted because this database is missing the placement columns."
          : undefined),
    });
  } catch (error: unknown) {
    if (isTenantResolutionError(error)) {
      return NextResponse.json(
        { ok: false, error: error.publicMessage },
        { status: 503 }
      );
    }

    const message = error instanceof Error ? error.message : "Confirm failed.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
