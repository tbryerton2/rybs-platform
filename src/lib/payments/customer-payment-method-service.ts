import "server-only";

import { findOrCreateCustomerProviderAccount } from "./customer-provider-accounts";
import { persistCustomerPaymentMethod } from "./customer-payment-methods";
import { createOrReuseSquareCustomer, saveSquareCard } from "./providers/square";
import type {
  PaymentProvider,
  PaymentProviderEnvironment,
  SaveCustomerPaymentMethodInput,
  SaveCustomerPaymentMethodResult,
} from "./types";

const DEFAULT_PAYMENT_PROVIDER = "square" satisfies PaymentProvider;

export class SaveCustomerPaymentMethodError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "SaveCustomerPaymentMethodError";
  }
}

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
  );
}

export async function saveCustomerPaymentMethod(
  input: SaveCustomerPaymentMethodInput,
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
        const names = getCustomerNames(input);
        const customerResult = await createOrReuseSquareCustomer({
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

        if (customerResult.providerEnvironment !== providerEnvironment) {
          throw new SaveCustomerPaymentMethodError(
            "Square returned a customer for a different provider environment.",
            "PROVIDER_ENVIRONMENT_MISMATCH",
          );
        }

        const customerProviderAccount = await findOrCreateCustomerProviderAccount({
          businessId,
          customerId,
          provider,
          providerEnvironment,
          providerCustomerId: customerResult.providerCustomerId,
        });

        const savedProviderPaymentMethod = await saveSquareCard({
          providerCustomerId: customerProviderAccount.providerCustomerId,
          cardSaveSourceId,
          idempotencyKey: clean(input.paymentMethodIdempotencyKey) ?? undefined,
          verificationToken: input.verificationToken,
          cardholderName: names.fullName,
          referenceId: customerId,
          billingAddress: input.address,
        });

        if (savedProviderPaymentMethod.providerEnvironment !== providerEnvironment) {
          throw new SaveCustomerPaymentMethodError(
            "Square returned a payment method for a different provider environment.",
            "PROVIDER_ENVIRONMENT_MISMATCH",
          );
        }

        const paymentMethod = await persistCustomerPaymentMethod({
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
