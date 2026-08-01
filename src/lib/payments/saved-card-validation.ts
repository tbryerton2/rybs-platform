import type { PaymentProvider, PaymentProviderEnvironment } from "./types";

export type SavedCardValidationInput = {
  id?: string | null;
  businessId?: string | null;
  business_id?: string | null;
  customerId?: string | null;
  customer_id?: string | null;
  provider?: PaymentProvider | string | null;
  providerEnvironment?: PaymentProviderEnvironment | string | null;
  provider_environment?: PaymentProviderEnvironment | string | null;
  providerCustomerId?: string | null;
  provider_customer_id?: string | null;
  providerPaymentMethodId?: string | null;
  provider_payment_method_id?: string | null;
  status?: string | null;
};

export type SavedCardValidationContext = {
  businessId: string;
  customerId: string | null | undefined;
  provider: PaymentProvider;
  providerEnvironment: PaymentProviderEnvironment;
};

export type SavedCardValidationFailureReason =
  | "saved_payment_method_missing"
  | "booking_customer_missing"
  | "saved_payment_method_customer_mismatch"
  | "saved_payment_method_business_mismatch"
  | "saved_payment_method_provider_mismatch"
  | "saved_payment_method_environment_mismatch"
  | "saved_payment_method_inactive"
  | "square_customer_id_missing"
  | "square_card_id_missing";

export type SavedCardValidationResult =
  | {
      ok: true;
      paymentMethod: SavedCardValidationInput;
      providerCustomerId: string;
      providerPaymentMethodId: string;
    }
  | {
      ok: false;
      reason: SavedCardValidationFailureReason;
      paymentMethod: SavedCardValidationInput | null;
    };

function clean(value: string | null | undefined) {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

export function getSavedPaymentMethodProviderCustomerId(paymentMethod: SavedCardValidationInput | null | undefined) {
  return clean(paymentMethod?.providerCustomerId) ?? clean(paymentMethod?.provider_customer_id);
}

export function getSavedPaymentMethodProviderPaymentMethodId(paymentMethod: SavedCardValidationInput | null | undefined) {
  return clean(paymentMethod?.providerPaymentMethodId) ?? clean(paymentMethod?.provider_payment_method_id);
}

export function validateUsableSavedPaymentMethod(
  paymentMethod: SavedCardValidationInput | null | undefined,
  context: SavedCardValidationContext,
): SavedCardValidationResult {
  if (!paymentMethod) {
    return { ok: false, reason: "saved_payment_method_missing", paymentMethod: null };
  }

  if (!clean(context.customerId ?? null)) {
    return { ok: false, reason: "booking_customer_missing", paymentMethod };
  }

  const businessId = clean(paymentMethod.businessId) ?? clean(paymentMethod.business_id);
  if (businessId && businessId !== context.businessId) {
    return { ok: false, reason: "saved_payment_method_business_mismatch", paymentMethod };
  }

  const customerId = clean(paymentMethod.customerId) ?? clean(paymentMethod.customer_id);
  if (customerId && customerId !== context.customerId) {
    return { ok: false, reason: "saved_payment_method_customer_mismatch", paymentMethod };
  }

  if (paymentMethod.provider && paymentMethod.provider !== context.provider) {
    return { ok: false, reason: "saved_payment_method_provider_mismatch", paymentMethod };
  }

  const providerEnvironment = paymentMethod.providerEnvironment ?? paymentMethod.provider_environment;
  if (providerEnvironment && providerEnvironment !== context.providerEnvironment) {
    return { ok: false, reason: "saved_payment_method_environment_mismatch", paymentMethod };
  }

  if (paymentMethod.status !== "active") {
    return { ok: false, reason: "saved_payment_method_inactive", paymentMethod };
  }

  const providerCustomerId = getSavedPaymentMethodProviderCustomerId(paymentMethod);
  if (!providerCustomerId) {
    return { ok: false, reason: "square_customer_id_missing", paymentMethod };
  }

  const providerPaymentMethodId = getSavedPaymentMethodProviderPaymentMethodId(paymentMethod);
  if (!providerPaymentMethodId) {
    return { ok: false, reason: "square_card_id_missing", paymentMethod };
  }

  return {
    ok: true,
    paymentMethod,
    providerCustomerId,
    providerPaymentMethodId,
  };
}
