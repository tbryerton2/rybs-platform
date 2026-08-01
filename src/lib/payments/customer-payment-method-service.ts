import "server-only";

import { findOrCreateCustomerProviderAccount } from "./customer-provider-accounts";
import { persistCustomerPaymentMethod } from "./customer-payment-methods";
import {
  createOrReuseSquareCustomer,
  findReusableSquareCard,
  saveSquareCard,
  SquarePaymentProviderOperationError,
  verifySquareSavedCard,
} from "./providers/square";
import type {
  PaymentProvider,
  PaymentProviderEnvironment,
  PaymentProviderCustomerInput,
  PaymentProviderCustomerResult,
  PaymentProviderFindSavedPaymentMethodInput,
  PaymentProviderSavePaymentMethodInput,
  PaymentProviderSavePaymentMethodResult,
  PersistCustomerPaymentMethodInput,
  SaveCustomerPaymentMethodInput,
  SaveCustomerPaymentMethodFailureStage,
  SaveCustomerPaymentMethodResult,
  StoredCustomerPaymentMethod,
  StoredCustomerProviderAccount,
} from "./types";

const DEFAULT_PAYMENT_PROVIDER = "square" satisfies PaymentProvider;

export class SaveCustomerPaymentMethodError extends Error {
  readonly code: string;
  readonly cause?: unknown;
  readonly failureStage: SaveCustomerPaymentMethodFailureStage;
  readonly safeErrorCode: string;
  readonly retryable: boolean;
  readonly correlationId: string | null;

  constructor(
    message: string,
    code: string,
    cause?: unknown,
    options: {
      failureStage?: SaveCustomerPaymentMethodFailureStage;
      safeErrorCode?: string;
      retryable?: boolean;
      correlationId?: string | null;
    } = {},
  ) {
    super(message);
    this.name = "SaveCustomerPaymentMethodError";
    this.code = code;
    this.cause = cause;
    this.failureStage = options.failureStage ?? "unexpected_failure";
    this.safeErrorCode = options.safeErrorCode ?? code;
    this.retryable = options.retryable ?? false;
    this.correlationId = options.correlationId ?? null;
  }
}

type SaveCustomerPaymentMethodOptions = {
  createOrReuseProviderCustomer?: (
    input: PaymentProviderCustomerInput,
  ) => Promise<PaymentProviderCustomerResult>;
  findReusableProviderPaymentMethod?: (
    input: PaymentProviderFindSavedPaymentMethodInput,
  ) => Promise<PaymentProviderSavePaymentMethodResult | null>;
  saveProviderPaymentMethod?: (
    input: PaymentProviderSavePaymentMethodInput,
  ) => Promise<PaymentProviderSavePaymentMethodResult>;
  verifyProviderPaymentMethod?: (input: {
    providerPaymentMethodId: string;
    providerCustomerId: string;
  }) => Promise<{
    ok: boolean;
    failureCode?: string | null;
    failureMessage?: string | null;
  }>;
  findOrCreateProviderAccount?: typeof findOrCreateCustomerProviderAccount;
  persistPaymentMethod?: (input: PersistCustomerPaymentMethodInput) => Promise<StoredCustomerPaymentMethod>;
};

function clean(value: string | null | undefined) {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

function cleanRequired(value: string | undefined, fieldName: string) {
  const cleaned = value?.trim();
  if (!cleaned) {
    throw new SaveCustomerPaymentMethodError(`${fieldName} is required.`, "VALIDATION_ERROR");
  }
  return cleaned;
}

function assertUuid(value: string, fieldName: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new SaveCustomerPaymentMethodError(`${fieldName} must be a valid UUID.`, "VALIDATION_ERROR");
  }
}

function normalizeProvider(value: PaymentProvider | undefined) {
  return value ?? DEFAULT_PAYMENT_PROVIDER;
}

function normalizeProviderEnvironment(value: PaymentProviderEnvironment) {
  if (value !== "sandbox" && value !== "production") {
    throw new SaveCustomerPaymentMethodError(
      "providerEnvironment must be sandbox or production.",
      "VALIDATION_ERROR",
    );
  }
  return value;
}

function normalizeConsentAcceptedAt(value: string | Date | undefined) {
  if (!value) {
    throw new SaveCustomerPaymentMethodError("consentAcceptedAt is required.", "CONSENT_REQUIRED");
  }

  const iso = value instanceof Date ? value.toISOString() : value.trim();
  if (!iso || Number.isNaN(Date.parse(iso))) {
    throw new SaveCustomerPaymentMethodError(
      "consentAcceptedAt must be a valid timestamp.",
      "VALIDATION_ERROR",
    );
  }

  return iso;
}

function getConfiguredSquareEnvironment() {
  const raw = (process.env.SQUARE_ENVIRONMENT || "sandbox").trim().toLowerCase();
  if (raw === "sandbox" || raw === "production") return raw;

  throw new SaveCustomerPaymentMethodError(
    "SQUARE_ENVIRONMENT must be either sandbox or production.",
    "PROVIDER_CONFIGURATION_ERROR",
  );
}

function assertProviderEnvironmentMatchesRuntime(
  provider: PaymentProvider,
  providerEnvironment: PaymentProviderEnvironment,
) {
  if (provider !== "square") return;

  const configuredEnvironment = getConfiguredSquareEnvironment();
  if (configuredEnvironment !== providerEnvironment) {
    throw new SaveCustomerPaymentMethodError(
      "providerEnvironment does not match the configured Square environment.",
      "PROVIDER_ENVIRONMENT_MISMATCH",
    );
  }
}

function splitName(name: string | null) {
  if (!name) {
    return {
      givenName: null,
      familyName: null,
    };
  }

  const parts = name.split(/\s+/).filter(Boolean);
  return {
    givenName: parts[0] ?? null,
    familyName: parts.slice(1).join(" ") || null,
  };
}

function getCustomerNames(input: SaveCustomerPaymentMethodInput) {
  const fullName = clean(input.name);
  const split = splitName(fullName);

  return {
    fullName,
    givenName: clean(input.givenName) ?? split.givenName,
    familyName: clean(input.familyName) ?? split.familyName,
  };
}

function getSafeError(error: unknown) {
  if (error instanceof SaveCustomerPaymentMethodError) return error;

  return new SaveCustomerPaymentMethodError(
    error instanceof Error ? error.message : "Unable to save customer payment method.",
    "SAVE_PAYMENT_METHOD_FAILED",
    error,
    {
      failureStage: "unexpected_failure",
      safeErrorCode: "SAVE_PAYMENT_METHOD_FAILED",
      retryable: false,
    },
  );
}

function toSaveCustomerPaymentMethodError(
  error: unknown,
  fallback: {
    message: string;
    code: string;
    failureStage: SaveCustomerPaymentMethodFailureStage;
    safeErrorCode: string;
    retryable: boolean;
    correlationId?: string | null;
  },
) {
  if (error instanceof SaveCustomerPaymentMethodError) return error;

  if (error instanceof SquarePaymentProviderOperationError) {
    return new SaveCustomerPaymentMethodError(error.message, fallback.code, error.cause, {
      failureStage: error.failureStage,
      safeErrorCode: error.safeErrorCode,
      retryable: error.retryable,
      correlationId: fallback.correlationId,
    });
  }

  return new SaveCustomerPaymentMethodError(
    error instanceof Error ? error.message : fallback.message,
    fallback.code,
    error,
    {
      failureStage: fallback.failureStage,
      safeErrorCode: fallback.safeErrorCode,
      retryable: fallback.retryable,
      correlationId: fallback.correlationId,
    },
  );
}

export async function saveCustomerPaymentMethod(
  input: SaveCustomerPaymentMethodInput,
  options: SaveCustomerPaymentMethodOptions = {},
): Promise<SaveCustomerPaymentMethodResult> {
  try {
    const businessId = cleanRequired(input.businessId, "businessId");
    const customerId = cleanRequired(input.customerId, "customerId");
    const cardSaveSourceId =
      clean(input.cardSaveSourceId) ?? cleanRequired(input.paymentMethodToken, "cardSaveSourceId");
    const provider = normalizeProvider(input.provider);
    const providerEnvironment = normalizeProviderEnvironment(input.providerEnvironment);
    const consentText = cleanRequired(input.consentText, "consentText");
    const consentAcceptedAt = normalizeConsentAcceptedAt(input.consentAcceptedAt);

    assertUuid(businessId, "businessId");
    assertUuid(customerId, "customerId");
    assertProviderEnvironmentMatchesRuntime(provider, providerEnvironment);

    switch (provider) {
      case "square": {
        const createOrReuseProviderCustomer =
          options.createOrReuseProviderCustomer ?? createOrReuseSquareCustomer;
        const findReusableProviderPaymentMethod =
          options.findReusableProviderPaymentMethod ?? findReusableSquareCard;
        const saveProviderPaymentMethod = options.saveProviderPaymentMethod ?? saveSquareCard;
        const verifyProviderPaymentMethod = options.verifyProviderPaymentMethod ?? verifySquareSavedCard;
        const findOrCreateProviderAccount =
          options.findOrCreateProviderAccount ?? findOrCreateCustomerProviderAccount;
        const persistPaymentMethod = options.persistPaymentMethod ?? persistCustomerPaymentMethod;
        const names = getCustomerNames(input);
        const cardCorrelationId = clean(input.paymentMethodIdempotencyKey) ?? null;
        let customerResult: PaymentProviderCustomerResult;

        try {
          customerResult = await createOrReuseProviderCustomer({
            localCustomerId: customerId,
            idempotencyKey: clean(input.customerIdempotencyKey) ?? undefined,
            referenceId: customerId,
            givenName: names.givenName,
            familyName: names.familyName,
            email: clean(input.email),
            phone: clean(input.phone),
            address: input.address,
            note: "Created by Tan Can Man card-on-file flow.",
          });
        } catch (error) {
          throw toSaveCustomerPaymentMethodError(error, {
            message: "Unable to create or find the Square customer.",
            code: "SQUARE_CUSTOMER_SAVE_FAILED",
            failureStage: "creating_square_customer",
            safeErrorCode: "SQUARE_CUSTOMER_SAVE_FAILED",
            retryable: true,
            correlationId: clean(input.customerIdempotencyKey),
          });
        }

        if (customerResult.providerEnvironment !== providerEnvironment) {
          throw new SaveCustomerPaymentMethodError(
            "Square returned a customer for a different provider environment.",
            "PROVIDER_ENVIRONMENT_MISMATCH",
            undefined,
            {
              failureStage: "linking_saved_method_to_customer",
              safeErrorCode: "PROVIDER_ENVIRONMENT_MISMATCH",
              retryable: false,
              correlationId: clean(input.customerIdempotencyKey),
            },
          );
        }

        let customerProviderAccount: StoredCustomerProviderAccount;
        try {
          customerProviderAccount = await findOrCreateProviderAccount({
            businessId,
            customerId,
            provider,
            providerEnvironment,
            providerCustomerId: customerResult.providerCustomerId,
          });
        } catch (error) {
          throw toSaveCustomerPaymentMethodError(error, {
            message: "Unable to link the Square customer to this booking customer.",
            code: "CUSTOMER_PROVIDER_ACCOUNT_LINK_FAILED",
            failureStage: "linking_saved_method_to_customer",
            safeErrorCode: "CUSTOMER_PROVIDER_ACCOUNT_LINK_FAILED",
            retryable: false,
            correlationId: clean(input.customerIdempotencyKey),
          });
        }

        let savedProviderPaymentMethod: PaymentProviderSavePaymentMethodResult;
        try {
          savedProviderPaymentMethod =
            (await findReusableProviderPaymentMethod({
              providerCustomerId: customerProviderAccount.providerCustomerId,
              referenceId: customerId,
            })) ??
            (await saveProviderPaymentMethod({
              providerCustomerId: customerProviderAccount.providerCustomerId,
              cardSaveSourceId,
              idempotencyKey: clean(input.paymentMethodIdempotencyKey) ?? undefined,
              verificationToken: input.verificationToken,
              cardholderName: names.fullName,
              referenceId: customerId,
              billingAddress: input.address,
            }));
        } catch (error) {
          throw toSaveCustomerPaymentMethodError(error, {
            message: "Unable to save the Square card.",
            code: "SQUARE_CARD_SAVE_FAILED",
            failureStage: "saving_square_card",
            safeErrorCode: "SQUARE_CARD_SAVE_FAILED",
            retryable: true,
            correlationId: cardCorrelationId,
          });
        }

        if (savedProviderPaymentMethod.providerEnvironment !== providerEnvironment) {
          throw new SaveCustomerPaymentMethodError(
            "Square returned a payment method for a different provider environment.",
            "PROVIDER_ENVIRONMENT_MISMATCH",
            undefined,
            {
              failureStage: "linking_saved_method_to_customer",
              safeErrorCode: "PROVIDER_ENVIRONMENT_MISMATCH",
              retryable: false,
              correlationId: cardCorrelationId,
            },
          );
        }

        try {
          const verification = await verifyProviderPaymentMethod({
            providerPaymentMethodId: savedProviderPaymentMethod.providerPaymentMethodId,
            providerCustomerId: customerProviderAccount.providerCustomerId,
          });

          if (!verification.ok) {
            throw new SaveCustomerPaymentMethodError(
              verification.failureMessage ?? "Saved Square card could not be verified.",
              "SAVED_CARD_VALIDATION_FAILED",
              undefined,
              {
                failureStage: "validating_saved_card",
                safeErrorCode: verification.failureCode ?? "SAVED_CARD_VALIDATION_FAILED",
                retryable: true,
                correlationId: cardCorrelationId,
              },
            );
          }
        } catch (error) {
          throw toSaveCustomerPaymentMethodError(error, {
            message: "Saved Square card could not be verified.",
            code: "SAVED_CARD_VALIDATION_FAILED",
            failureStage: "validating_saved_card",
            safeErrorCode: "SAVED_CARD_VALIDATION_FAILED",
            retryable: true,
            correlationId: cardCorrelationId,
          });
        }

        let paymentMethod: StoredCustomerPaymentMethod;
        try {
          paymentMethod = await persistPaymentMethod({
            businessId,
            customerId,
            customerProviderAccountId: customerProviderAccount.id,
            provider,
            providerEnvironment,
            providerCustomerId: customerProviderAccount.providerCustomerId,
            providerPaymentMethodId: savedProviderPaymentMethod.providerPaymentMethodId,
            cardBrand: savedProviderPaymentMethod.cardBrand,
            cardLast4: savedProviderPaymentMethod.cardLast4,
            cardExpMonth: savedProviderPaymentMethod.cardExpMonth,
            cardExpYear: savedProviderPaymentMethod.cardExpYear,
            consentText,
            consentAcceptedAt,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "";
          const ownershipFailure =
            message.includes("different customer") ||
            message.includes("different customer provider account");

          throw toSaveCustomerPaymentMethodError(error, {
            message: "Unable to persist the saved payment method.",
            code: ownershipFailure
              ? "SAVED_METHOD_OWNERSHIP_MISMATCH"
              : "CUSTOMER_PAYMENT_METHOD_PERSIST_FAILED",
            failureStage: ownershipFailure
              ? "linking_saved_method_to_customer"
              : "writing_customer_payment_methods",
            safeErrorCode: ownershipFailure
              ? "SAVED_METHOD_OWNERSHIP_MISMATCH"
              : "CUSTOMER_PAYMENT_METHOD_PERSIST_FAILED",
            retryable: !ownershipFailure,
            correlationId: cardCorrelationId,
          });
        }

        return {
          customerProviderAccount,
          paymentMethod,
        };
      }
      default: {
        const exhaustiveProvider: never = provider;
        throw new SaveCustomerPaymentMethodError(
          `Unsupported payment provider: ${exhaustiveProvider}`,
          "UNSUPPORTED_PROVIDER",
        );
      }
    }
  } catch (error) {
    throw getSafeError(error);
  }
}
