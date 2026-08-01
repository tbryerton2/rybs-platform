import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type {
  PaymentProvider,
  PaymentProviderEnvironment,
  PersistCustomerPaymentMethodInput,
  StoredCustomerPaymentMethod,
} from "./types";

const DEFAULT_PAYMENT_PROVIDER = "square" satisfies PaymentProvider;
const CUSTOMER_PAYMENT_METHOD_SELECT =
  "id, business_id, customer_id, customer_provider_account_id, provider, provider_environment, provider_customer_id, provider_payment_method_id, card_brand, card_last_4, card_exp_month, card_exp_year, status, consent_text, consent_accepted_at, created_at, updated_at";

type CustomerPaymentMethodRow = {
  id: string;
  business_id: string;
  customer_id: string;
  customer_provider_account_id: string | null;
  provider: string;
  provider_environment: string;
  provider_customer_id: string;
  provider_payment_method_id: string;
  card_brand: string | null;
  card_last_4: string | null;
  card_exp_month: number | null;
  card_exp_year: number | null;
  status: string;
  consent_text: string | null;
  consent_accepted_at: string | null;
  created_at: string;
  updated_at: string;
};

export class CustomerPaymentMethodServiceError extends Error {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "CustomerPaymentMethodServiceError";
    this.cause = cause;
  }
}

function clean(value: string | null | undefined) {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

function cleanRequired(value: string | undefined, fieldName: string) {
  const cleaned = value?.trim();
  if (!cleaned) {
    throw new CustomerPaymentMethodServiceError(`${fieldName} is required.`);
  }
  return cleaned;
}

function assertUuid(value: string, fieldName: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new CustomerPaymentMethodServiceError(`${fieldName} must be a valid UUID.`);
  }
}

function normalizeProvider(value: PaymentProvider | undefined) {
  return value ?? DEFAULT_PAYMENT_PROVIDER;
}

function normalizeProviderEnvironment(value: PaymentProviderEnvironment) {
  if (value !== "sandbox" && value !== "production") {
    throw new CustomerPaymentMethodServiceError("providerEnvironment must be sandbox or production.");
  }
  return value;
}

function normalizeCardLast4(value: string | null | undefined) {
  const cleaned = clean(value);
  if (!cleaned) return null;
  if (!/^\d{4}$/.test(cleaned)) {
    throw new CustomerPaymentMethodServiceError("cardLast4 must contain exactly the final four display digits.");
  }
  return cleaned;
}

function normalizeCardExpMonth(value: number | null | undefined) {
  if (value == null) return null;
  if (!Number.isInteger(value) || value < 1 || value > 12) {
    throw new CustomerPaymentMethodServiceError("cardExpMonth must be between 1 and 12.");
  }
  return value;
}

function normalizeCardExpYear(value: number | null | undefined) {
  if (value == null) return null;
  if (!Number.isInteger(value) || value < 0) {
    throw new CustomerPaymentMethodServiceError("cardExpYear must be a non-negative integer.");
  }
  return value;
}

function normalizeConsentAcceptedAt(value: string | Date | null | undefined) {
  if (value == null) return null;
  const iso = value instanceof Date ? value.toISOString() : value.trim();
  if (!iso || Number.isNaN(Date.parse(iso))) {
    throw new CustomerPaymentMethodServiceError("consentAcceptedAt must be a valid timestamp.");
  }
  return iso;
}

function isUniqueViolation(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "23505");
}

function toStoredCustomerPaymentMethod(row: CustomerPaymentMethodRow): StoredCustomerPaymentMethod {
  return {
    id: row.id,
    businessId: row.business_id,
    customerId: row.customer_id,
    customerProviderAccountId: row.customer_provider_account_id,
    provider: row.provider as PaymentProvider,
    providerEnvironment: row.provider_environment as PaymentProviderEnvironment,
    providerCustomerId: row.provider_customer_id,
    providerPaymentMethodId: row.provider_payment_method_id,
    cardBrand: row.card_brand,
    cardLast4: row.card_last_4,
    cardExpMonth: row.card_exp_month,
    cardExpYear: row.card_exp_year,
    status: row.status as StoredCustomerPaymentMethod["status"],
    consentText: row.consent_text,
    consentAcceptedAt: row.consent_accepted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function assertSamePaymentMethodOwner(
  row: StoredCustomerPaymentMethod,
  input: {
    businessId: string;
    customerId: string;
    customerProviderAccountId: string | null;
    providerCustomerId: string;
  },
) {
  if (
    row.businessId !== input.businessId ||
    row.customerId !== input.customerId ||
    row.providerCustomerId !== input.providerCustomerId
  ) {
    throw new CustomerPaymentMethodServiceError(
      "providerPaymentMethodId is already mapped to a different customer payment method.",
    );
  }

  if (
    input.customerProviderAccountId &&
    row.customerProviderAccountId &&
    row.customerProviderAccountId !== input.customerProviderAccountId
  ) {
    throw new CustomerPaymentMethodServiceError(
      "providerPaymentMethodId is already linked to a different customer provider account.",
    );
  }
}

async function findByProviderPaymentMethod(input: {
  provider: PaymentProvider;
  providerEnvironment: PaymentProviderEnvironment;
  providerPaymentMethodId: string;
}) {
  const { data, error } = await supabaseAdmin
    .from("customer_payment_methods")
    .select(CUSTOMER_PAYMENT_METHOD_SELECT)
    .eq("provider", input.provider)
    .eq("provider_environment", input.providerEnvironment)
    .eq("provider_payment_method_id", input.providerPaymentMethodId)
    .maybeSingle<CustomerPaymentMethodRow>();

  if (error) {
    throw new CustomerPaymentMethodServiceError(error.message, error);
  }

  return data ? toStoredCustomerPaymentMethod(data) : null;
}

export async function findCustomerPaymentMethodByProviderId(input: {
  provider?: PaymentProvider;
  providerEnvironment: PaymentProviderEnvironment;
  providerPaymentMethodId: string;
}) {
  return findByProviderPaymentMethod({
    provider: normalizeProvider(input.provider),
    providerEnvironment: normalizeProviderEnvironment(input.providerEnvironment),
    providerPaymentMethodId: cleanRequired(input.providerPaymentMethodId, "providerPaymentMethodId"),
  });
}

export async function persistCustomerPaymentMethod(input: PersistCustomerPaymentMethodInput) {
  const businessId = cleanRequired(input.businessId, "businessId");
  const customerId = cleanRequired(input.customerId, "customerId");
  const customerProviderAccountId = clean(input.customerProviderAccountId);
  const provider = normalizeProvider(input.provider);
  const providerEnvironment = normalizeProviderEnvironment(input.providerEnvironment);
  const providerCustomerId = cleanRequired(input.providerCustomerId, "providerCustomerId");
  const providerPaymentMethodId = cleanRequired(input.providerPaymentMethodId, "providerPaymentMethodId");
  const cardBrand = clean(input.cardBrand);
  const cardLast4 = normalizeCardLast4(input.cardLast4);
  const cardExpMonth = normalizeCardExpMonth(input.cardExpMonth);
  const cardExpYear = normalizeCardExpYear(input.cardExpYear);
  const consentText = clean(input.consentText);
  const consentAcceptedAt = normalizeConsentAcceptedAt(input.consentAcceptedAt);

  assertUuid(businessId, "businessId");
  assertUuid(customerId, "customerId");
  if (customerProviderAccountId) {
    assertUuid(customerProviderAccountId, "customerProviderAccountId");
  }

  const existing = await findByProviderPaymentMethod({
    provider,
    providerEnvironment,
    providerPaymentMethodId,
  });

  if (existing) {
    assertSamePaymentMethodOwner(existing, {
      businessId,
      customerId,
      customerProviderAccountId,
      providerCustomerId,
    });
    return existing;
  }

  const { data, error } = await supabaseAdmin
    .from("customer_payment_methods")
    .insert({
      business_id: businessId,
      customer_id: customerId,
      customer_provider_account_id: customerProviderAccountId,
      provider,
      provider_environment: providerEnvironment,
      provider_customer_id: providerCustomerId,
      provider_payment_method_id: providerPaymentMethodId,
      card_brand: cardBrand,
      card_last_4: cardLast4,
      card_exp_month: cardExpMonth,
      card_exp_year: cardExpYear,
      status: "active",
      consent_text: consentText,
      consent_accepted_at: consentAcceptedAt,
    })
    .select(CUSTOMER_PAYMENT_METHOD_SELECT)
    .single<CustomerPaymentMethodRow>();

  if (error || !data) {
    if (isUniqueViolation(error)) {
      const raced = await findByProviderPaymentMethod({
        provider,
        providerEnvironment,
        providerPaymentMethodId,
      });
      if (raced) {
        assertSamePaymentMethodOwner(raced, {
          businessId,
          customerId,
          customerProviderAccountId,
          providerCustomerId,
        });
        return raced;
      }
    }

    throw new CustomerPaymentMethodServiceError(
      error?.message ?? "Unable to persist customer payment method.",
      error,
    );
  }

  return toStoredCustomerPaymentMethod(data);
}
