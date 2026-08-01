import "server-only";

import { randomUUID } from "node:crypto";
import { SquareClient, SquareEnvironment, SquareError } from "square";
import type { Address, Currency } from "square";
import type {
  PaymentProviderCustomerInput,
  PaymentProviderCustomerResult,
  PaymentProviderFindSavedPaymentMethodInput,
  PaymentProviderAdapter,
  PaymentProviderChargeInput,
  PaymentProviderChargeResult,
  PaymentProviderEnvironment,
  PaymentProviderSavePaymentMethodInput,
  PaymentProviderSavePaymentMethodResult,
  SaveCustomerPaymentMethodFailureStage,
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

export class SquarePaymentProviderOperationError extends Error {
  readonly failureStage: SaveCustomerPaymentMethodFailureStage;
  readonly safeErrorCode: string;
  readonly retryable: boolean;
  readonly cause?: unknown;

  constructor(
    message: string,
    failureStage: SaveCustomerPaymentMethodFailureStage,
    safeErrorCode: string,
    retryable: boolean,
    cause?: unknown,
  ) {
    super(message);
    this.name = "SquarePaymentProviderOperationError";
    this.failureStage = failureStage;
    this.safeErrorCode = safeErrorCode;
    this.retryable = retryable;
    this.cause = cause;
  }
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

function toSquareOperationError(
  error: unknown,
  failureStage: SaveCustomerPaymentMethodFailureStage,
  fallbackCode: string,
  retryable: boolean,
) {
  const squareError = extractSquareError(error);
  return new SquarePaymentProviderOperationError(
    squareError.message,
    failureStage,
    squareError.code ?? fallbackCode,
    retryable,
    squareError.raw,
  );
}

function squareResponseError(
  fallbackMessage: string,
  errors: Array<{ code?: string; detail?: string }> | undefined,
  failureStage: SaveCustomerPaymentMethodFailureStage,
  fallbackCode: string,
  retryable: boolean,
) {
  const squareError = firstSquareErrorMessage(errors);
  return new SquarePaymentProviderOperationError(
    squareError.message ?? squareError.code ?? fallbackMessage,
    failureStage,
    squareError.code ?? fallbackCode,
    retryable,
  );
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
        throw squareResponseError(
          "Square customer search failed.",
          searchResponse.errors,
          "finding_square_customer",
          "SQUARE_CUSTOMER_SEARCH_FAILED",
          true,
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
      if (error instanceof SquarePaymentProviderOperationError) throw error;
      throw toSquareOperationError(error, "finding_square_customer", "SQUARE_CUSTOMER_SEARCH_FAILED", true);
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
      throw squareResponseError(
        "Square customer creation failed.",
        response.errors,
        "creating_square_customer",
        "SQUARE_CUSTOMER_CREATE_FAILED",
        true,
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
    if (error instanceof SquarePaymentProviderOperationError) throw error;
    throw toSquareOperationError(error, "creating_square_customer", "SQUARE_CUSTOMER_CREATE_FAILED", true);
  }
}

function toSavedPaymentMethodResult(input: {
  providerEnvironment: PaymentProviderEnvironment;
  providerCustomerId: string;
  card: {
    id?: string | null;
    cardBrand?: string | null;
    last4?: string | null;
    expMonth?: bigint | number | null;
    expYear?: bigint | number | null;
  } | null | undefined;
}): PaymentProviderSavePaymentMethodResult {
  return {
    provider: "square",
    providerEnvironment: input.providerEnvironment,
    providerCustomerId: input.providerCustomerId,
    providerPaymentMethodId: requireSquareId(input.card?.id, "providerPaymentMethodId"),
    cardBrand: input.card?.cardBrand ?? null,
    cardLast4: input.card?.last4 ?? null,
    cardExpMonth: bigintToNumber(input.card?.expMonth),
    cardExpYear: bigintToNumber(input.card?.expYear),
  };
}

export async function findReusableSquareCard(
  input: PaymentProviderFindSavedPaymentMethodInput,
): Promise<PaymentProviderSavePaymentMethodResult | null> {
  const environment = resolveSquareEnvironment();
  const client = createSquareClient(environment);
  const providerCustomerId = requireSquareId(input.providerCustomerId, "providerCustomerId");
  const referenceId = clean(input.referenceId);

  try {
    const page = await client.cards.list({
      customerId: providerCustomerId,
      includeDisabled: false,
      referenceId,
    });

    for await (const card of page) {
      if (card.enabled !== true) continue;
      if (card.customerId !== providerCustomerId) continue;
      if (referenceId && card.referenceId !== referenceId) continue;

      return toSavedPaymentMethodResult({
        providerEnvironment: environment,
        providerCustomerId,
        card,
      });
    }
  } catch (error) {
    throw toSquareOperationError(error, "saving_square_card", "SQUARE_CARD_LIST_FAILED", true);
  }

  return null;
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
      throw squareResponseError(
        "Square card save failed.",
        response.errors,
        "saving_square_card",
        "SQUARE_CARD_SAVE_FAILED",
        true,
      );
    }

    const card = response.card;
    return {
      ...toSavedPaymentMethodResult({
        providerEnvironment: environment,
        providerCustomerId,
        card,
      }),
      rawProviderResponse: response,
    };
  } catch (error) {
    if (error instanceof SquarePaymentProviderOperationError) throw error;
    throw toSquareOperationError(error, "saving_square_card", "SQUARE_CARD_SAVE_FAILED", true);
  }
}

export async function verifySquareSavedCard(input: {
  providerPaymentMethodId: string;
  providerCustomerId: string;
}) {
  const environment = resolveSquareEnvironment();
  const client = createSquareClient(environment);
  const cardId = requireSquareId(input.providerPaymentMethodId, "providerPaymentMethodId");
  const expectedCustomerId = requireSquareId(input.providerCustomerId, "providerCustomerId");

  try {
    const response = await client.cards.get({ cardId });
    const card = response.card;
    const providerPaymentMethodId = card?.id ?? null;
    const providerCustomerId = card?.customerId ?? null;
    const enabled = card?.enabled ?? null;

    return {
      ok: providerPaymentMethodId === cardId && providerCustomerId === expectedCustomerId && enabled === true,
      providerPaymentMethodId,
      providerCustomerId,
      enabled,
      failureCode:
        providerPaymentMethodId !== cardId
          ? "SQUARE_CARD_ID_MISMATCH"
          : providerCustomerId !== expectedCustomerId
            ? "SQUARE_CUSTOMER_MISMATCH"
            : enabled !== true
              ? "SQUARE_CARD_DISABLED"
              : null,
      failureMessage:
        providerPaymentMethodId !== cardId
          ? "Square returned a different card ID."
          : providerCustomerId !== expectedCustomerId
            ? "Square card belongs to a different customer."
            : enabled !== true
              ? "Square card is not available for payments."
              : null,
      rawProviderResponse: response,
    };
  } catch (error) {
    const squareError = extractSquareError(error);

    return {
      ok: false,
      providerPaymentMethodId: cardId,
      providerCustomerId: null,
      enabled: null,
      failureCode: squareError.code,
      failureMessage: squareError.message,
      rawProviderResponse: squareError.raw,
    };
  }
}

export function createSquarePaymentAdapter(): PaymentProviderAdapter {
  const environment = resolveSquareEnvironment();

  return {
    provider: "square",
    environment,
    async verifySavedPaymentMethod(input) {
      return verifySquareSavedCard(input);
    },
    async charge(input: PaymentProviderChargeInput): Promise<PaymentProviderChargeResult> {
      const locationId = getSquareLocationId();
      const client = createSquareClient(environment);
      const sourceId = requireSquareId(
        input.paymentSourceId ?? input.paymentMethodToken,
        "paymentSourceId",
      );

      try {
        const response = await client.payments.create({
          sourceId,
          idempotencyKey: input.idempotencyKey,
          amountMoney: {
            amount: BigInt(input.amountCents),
            currency: input.currency as Currency,
          },
          autocomplete: true,
          locationId,
          customerId: clean(input.providerCustomerId) ?? undefined,
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
