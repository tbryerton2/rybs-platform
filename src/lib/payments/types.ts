export type PaymentProvider = "square";

export type PaymentProviderEnvironment = "sandbox" | "production";

export type PaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "canceled"
  | "refunded"
  | "partially_refunded";

export type CurrencyCode = string;

export type CreateCheckoutPaymentInput = {
  businessId: string;
  bookingHoldId: string;
  amountCents: number;
  currency?: CurrencyCode;
  paymentProvider?: PaymentProvider;
  paymentMethodToken: string;
  description?: string;
  idempotencyKey?: string;
};

export type StoredCheckoutPayment = {
  id: string;
  businessId: string;
  bookingHoldId: string;
  bookingId: string | null;
  provider: PaymentProvider;
  providerEnvironment: PaymentProviderEnvironment;
  status: PaymentStatus;
  amountCents: number;
  currency: CurrencyCode;
  providerPaymentId: string | null;
  providerOrderId: string | null;
  providerLocationId: string | null;
  idempotencyKey: string;
  failureCode: string | null;
  failureMessage: string | null;
  rawProviderResponse: unknown | null;
  paidAt: string | null;
  failedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PaymentProviderChargeInput = {
  paymentId: string;
  businessId: string;
  bookingHoldId: string;
  amountCents: number;
  currency: CurrencyCode;
  paymentMethodToken: string;
  idempotencyKey: string;
  description?: string;
};

export type PaymentProviderChargeResult = {
  status: PaymentStatus;
  providerPaymentId?: string | null;
  providerOrderId?: string | null;
  providerLocationId?: string | null;
  rawProviderResponse?: unknown | null;
  paidAt?: string | null;
  failedAt?: string | null;
  failureCode?: string | null;
  failureMessage?: string | null;
};

export type PaymentProviderAdapter = {
  provider: PaymentProvider;
  environment: PaymentProviderEnvironment;
  charge(input: PaymentProviderChargeInput): Promise<PaymentProviderChargeResult>;
};

export type CheckoutPaymentResult = {
  ok: boolean;
  paymentId: string;
  businessId: string;
  bookingHoldId: string;
  bookingId: string | null;
  paymentProvider: PaymentProvider;
  providerEnvironment: PaymentProviderEnvironment;
  status: PaymentStatus;
  amountCents: number;
  currency: CurrencyCode;
  idempotencyKey: string;
  providerPaymentId: string | null;
  providerOrderId: string | null;
  providerLocationId: string | null;
  paidAt: string | null;
  failedAt: string | null;
  failureCode: string | null;
  failureMessage: string | null;
};
