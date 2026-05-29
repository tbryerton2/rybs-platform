import "server-only";

import { randomUUID } from "node:crypto";
import { SquareClient, SquareEnvironment, SquareError } from "square";
import type { Address, Currency } from "square";
import type {
  PaymentProviderCustomerInput,
  PaymentProviderCustomerResult,
  PaymentProviderAdapter,
  PaymentProviderChargeInput,
  PaymentProviderChargeResult,
  PaymentProviderEnvironment,
  PaymentProviderSavePaymentMethodInput,
  PaymentProviderSavePaymentMethodResult,
  PaymentStatus,
} from "../types";

function resolveSquareEnvironment(): PaymentProviderEnvironment {
  const raw = (process.env.SQUARE_ENVIRONMENT || "sandbox").trim().toLowerCase();

  if (raw === "production") return "production";
  if (raw === "sandbox") return "sandbox";

  throw new Error("SQUARE_ENVIRONMENT must be either 'sandbox' or 'production'.");
}

function resolveSquareBaseUrl(environment: PaymentProviderEnvironment) {
  return environment === "production" ? SquareEnvironment.Production : SquareEnvironment.Sandbox;
}

function getSquareAccessToken() {
  const token = process.env.SQUARE_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new Error("SQUARE_ACCESS_TOKEN is required for Square checkout payments.");
  }
  return token;
}

function getSquareLocationId() {
  const locationId = process.env.SQUARE_LOCATION_ID?.trim();
  if (!locationId) {
    throw new Error("SQUARE_LOCATION_ID is required for Square checkout payments. Add it to .env.local.");
  }
  return locationId;
}

function createSquareClient(environment: PaymentProviderEnvironment) {
  return new SquareClient({
    environment: resolveSquareBaseUrl(environment),
    token: getSquareAccessToken(),
  });
}

function mapSquareStatus(status: string | null | undefined): PaymentStatus {
  switch ((status || "").toUpperCase()) {
    case "COMPLETED":
      return "paid";
    case "FAILED":
      return "failed";
    case "CANCELED":
    case "CANCELLED":
      return "canceled";
    case "APPROVED":
    case "PENDING":
    default:
      return "pending";
  }
}

function firstSquareErrorMessage(errors: Array<{ code?: string; detail?: string }> | undefined) {
  const first = errors?.[0];
  return {
    code: first?.code ?? null,
    message: first?.detail ?? null,
  };
}

function extractSquareError(error: unknown) {
  if (error instanceof SquareError) {
    const first = error.errors?.[0];
    return {
      code: first?.code ?? String(error.statusCode ?? "SQUARE_ERROR"),
      message: first?.detail ?? (error.message || "Square payment failed."),
      raw: error.body ?? { message: error.message, statusCode: error.statusCode, errors: error.errors },
    };
  }

  if (error instanceof Error) {
    return {
      code: "SQUARE_ERROR",
      message: error.message || "Square payment failed.",
      raw: { message: error.message },
    };
  }

  return {
    code: "SQUARE_ERROR",
    message: "Square payment failed.",
    raw: { error },
  };
}

function clean(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function toSquareAddress(
  value:
    | {
        addressLine1?: string | null;
        addressLine2?: string | null;
        locality?: string | null;
        administrativeDistrictLevel1?: string | null;
        postalCode?: string | null;
        country?: "US";
      }
    | null
    | undefined,
): Address | undefined {
  if (!value) return undefined;

  const address: Address = {
    addressLine1: clean(value.addressLine1),
    addressLine2: clean(value.addressLine2),
    locality: clean(value.locality),
    administrativeDistrictLevel1: clean(value.administrativeDistrictLevel1),
    postalCode: clean(value.postalCode),
    country: value.country ?? "US",
  };

  if (
    !address.addressLine1 &&
    !address.addressLine2 &&
    !address.locality &&
    !address.administrativeDistrictLevel1 &&
    !address.postalCode
  ) {
    return undefined;
  }

  return address;
}

function getProviderCustomerReferenceId(input: PaymentProviderCustomerInput) {
  return clean(input.referenceId) ?? clean(input.localCustomerId);
}

function getSquareProviderErrorMessage(
  fallback: string,
  errors: Array<{ code?: string; detail?: string }> | undefined,
) {
  const squareError = firstSquareErrorMessage(errors);
  return squareError.message ?? squareError.code ?? fallback;
}

function requireSquareId(value: string | null | undefined, fieldName: string) {
  const cleaned = clean(value);
  if (!cleaned) {
    throw new Error(`${fieldName} is required.`);
  }
  return cleaned;
}

function bigintToNumber(value: bigint | number | null | undefined) {
  if (value == null) return null;
  return Number(value);
}

export async function createOrReuseSquareCustomer(
  input: PaymentProviderCustomerInput,
): Promise<PaymentProviderCustomerResult> {
  const environment = resolveSquareEnvironment();
  const client = createSquareClient(environment);
  const referenceId = getProviderCustomerReferenceId(input);

  if (referenceId) {
    try {
      const searchResponse = await client.customers.search({
        limit: BigInt(1),
        query: {
          filter: {
            referenceId: {
              exact: referenceId,
            },
          },
        },
      });

      if (searchResponse.errors?.length) {
        throw new Error(
          getSquareProviderErrorMessage("Square customer search failed.", searchResponse.errors),
        );
      }

      const existingCustomer = searchResponse.customers?.find((customer) => clean(customer.id));
      if (existingCustomer?.id) {
        return {
          provider: "square",
          providerEnvironment: environment,
          providerCustomerId: existingCustomer.id,
          reused: true,
          rawProviderResponse: searchResponse,
        };
      }
    } catch (error) {
      const squareError = extractSquareError(error);
      throw new Error(squareError.message, { cause: squareError.raw });
    }
  }

  const givenName = clean(input.givenName);
  const familyName = clean(input.familyName);
  const companyName = clean(input.companyName);
  const emailAddress = clean(input.email);
  const phoneNumber = clean(input.phone);

  if (!givenName && !familyName && !companyName && !emailAddress && !phoneNumber) {
    throw new Error(
      "Square customer creation requires at least one name, company, email, or phone field.",
    );
  }

  try {
    const response = await client.customers.create({
      idempotencyKey: clean(input.idempotencyKey) ?? randomUUID(),
      givenName: givenName ?? undefined,
      familyName: familyName ?? undefined,
      companyName: companyName ?? undefined,
      emailAddress: emailAddress ?? undefined,
      phoneNumber: phoneNumber ?? undefined,
      address: toSquareAddress(input.address),
      referenceId: referenceId ?? undefined,
      note: clean(input.note) ?? undefined,
    });

    if (response.errors?.length) {
      throw new Error(
        getSquareProviderErrorMessage("Square customer creation failed.", response.errors),
      );
    }

    return {
      provider: "square",
      providerEnvironment: environment,
      providerCustomerId: requireSquareId(response.customer?.id, "providerCustomerId"),
      reused: false,
      rawProviderResponse: response,
    };
  } catch (error) {
    const squareError = extractSquareError(error);
    throw new Error(squareError.message, { cause: squareError.raw });
  }
}

export async function saveSquareCard(
  input: PaymentProviderSavePaymentMethodInput,
): Promise<PaymentProviderSavePaymentMethodResult> {
  const environment = resolveSquareEnvironment();
  const client = createSquareClient(environment);
  const providerCustomerId = requireSquareId(input.providerCustomerId, "providerCustomerId");
  const cardSaveSourceId = requireSquareId(
    input.cardSaveSourceId ?? input.paymentMethodToken,
    "cardSaveSourceId",
  );

  try {
    const response = await client.cards.create({
      idempotencyKey: clean(input.idempotencyKey) ?? randomUUID(),
      sourceId: cardSaveSourceId,
      verificationToken: clean(input.verificationToken) ?? undefined,
      card: {
        customerId: providerCustomerId,
        cardholderName: clean(input.cardholderName),
        referenceId: clean(input.referenceId),
        billingAddress: toSquareAddress(input.billingAddress),
      },
    });

    if (response.errors?.length) {
      throw new Error(getSquareProviderErrorMessage("Square card save failed.", response.errors));
    }

    const card = response.card;

    return {
      provider: "square",
      providerEnvironment: environment,
      providerCustomerId,
      providerPaymentMethodId: requireSquareId(card?.id, "providerPaymentMethodId"),
      cardBrand: card?.cardBrand ?? null,
      cardLast4: card?.last4 ?? null,
      cardExpMonth: bigintToNumber(card?.expMonth),
      cardExpYear: bigintToNumber(card?.expYear),
      rawProviderResponse: response,
    };
  } catch (error) {
    const squareError = extractSquareError(error);
    throw new Error(squareError.message, { cause: squareError.raw });
  }
}

export function createSquarePaymentAdapter(): PaymentProviderAdapter {
  const environment = resolveSquareEnvironment();

  return {
    provider: "square",
    environment,
    async charge(input: PaymentProviderChargeInput): Promise<PaymentProviderChargeResult> {
      const locationId = getSquareLocationId();
      const client = createSquareClient(environment);

      try {
        const response = await client.payments.create({
          sourceId: input.paymentMethodToken,
          idempotencyKey: input.idempotencyKey,
          amountMoney: {
            amount: BigInt(input.amountCents),
            currency: input.currency as Currency,
          },
          autocomplete: true,
          locationId,
          referenceId: input.paymentId,
          note: input.description,
        });

        const payment = response.payment;
        const status = mapSquareStatus(payment?.status);
        const squareError = firstSquareErrorMessage(response.errors);
        const failedAt = status === "failed" || status === "canceled" ? new Date().toISOString() : null;

        return {
          status,
          providerPaymentId: payment?.id ?? null,
          providerOrderId: payment?.orderId ?? null,
          providerLocationId: payment?.locationId ?? locationId,
          rawProviderResponse: response,
          paidAt: status === "paid" ? payment?.updatedAt ?? new Date().toISOString() : null,
          failedAt,
          failureCode: status === "failed" || status === "canceled" ? squareError.code ?? status : null,
          failureMessage:
            status === "failed" || status === "canceled"
              ? squareError.message ?? `Square payment ${status}.`
              : null,
        };
      } catch (error) {
        const squareError = extractSquareError(error);

        return {
          status: "failed",
          providerLocationId: locationId,
          rawProviderResponse: squareError.raw,
          failedAt: new Date().toISOString(),
          failureCode: squareError.code,
          failureMessage: squareError.message,
        };
      }
    },
  };
}
