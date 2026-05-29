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

export type StoredCustomerProviderAccount = {
  id: string;
  businessId: string;
  customerId: string;
  provider: PaymentProvider;
  providerEnvironment: PaymentProviderEnvironment;
  providerCustomerId: string;
  status: "active" | "disabled";
  createdAt: string;
  updatedAt: string;
};

export type FindOrCreateCustomerProviderAccountInput = {
  businessId: string;
  customerId: string;
  provider?: PaymentProvider;
  providerEnvironment: PaymentProviderEnvironment;
  providerCustomerId: string;
};

export type StoredCustomerPaymentMethod = {
  id: string;
  businessId: string;
  customerId: string;
  customerProviderAccountId: string | null;
  provider: PaymentProvider;
  providerEnvironment: PaymentProviderEnvironment;
  providerCustomerId: string;
  providerPaymentMethodId: string;
  cardBrand: string | null;
  cardLast4: string | null;
  cardExpMonth: number | null;
  cardExpYear: number | null;
  status: "active" | "disabled" | "expired";
  consentText: string | null;
  consentAcceptedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PersistCustomerPaymentMethodInput = {
  businessId: string;
  customerId: string;
  customerProviderAccountId?: string | null;
  provider?: PaymentProvider;
  providerEnvironment: PaymentProviderEnvironment;
  providerCustomerId: string;
  providerPaymentMethodId: string;
  cardBrand?: string | null;
  cardLast4?: string | null;
  cardExpMonth?: number | null;
  cardExpYear?: number | null;
  consentText?: string | null;
  consentAcceptedAt?: string | Date | null;
};

export type PaymentProviderCustomerInput = {
  localCustomerId?: string;
  idempotencyKey?: string;
  referenceId?: string;
  givenName?: string | null;
  familyName?: string | null;
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: {
    addressLine1?: string | null;
    addressLine2?: string | null;
    locality?: string | null;
    administrativeDistrictLevel1?: string | null;
    postalCode?: string | null;
    country?: "US";
  } | null;
  note?: string | null;
};

export type PaymentProviderCustomerResult = {
  provider: PaymentProvider;
  providerEnvironment: PaymentProviderEnvironment;
  providerCustomerId: string;
  reused: boolean;
  rawProviderResponse?: unknown;
};

export type PaymentProviderSavePaymentMethodInput = {
  providerCustomerId: string;
  paymentMethodToken?: string;
  cardSaveSourceId?: string;
  idempotencyKey?: string;
  verificationToken?: string | null;
  cardholderName?: string | null;
  referenceId?: string | null;
  billingAddress?: {
    addressLine1?: string | null;
    addressLine2?: string | null;
    locality?: string | null;
    administrativeDistrictLevel1?: string | null;
    postalCode?: string | null;
    country?: "US";
  } | null;
};

export type PaymentProviderSavePaymentMethodResult = {
  provider: PaymentProvider;
  providerEnvironment: PaymentProviderEnvironment;
  providerCustomerId: string;
  providerPaymentMethodId: string;
  cardBrand: string | null;
  cardLast4: string | null;
  cardExpMonth: number | null;
  cardExpYear: number | null;
  rawProviderResponse?: unknown;
};

export type SaveCustomerPaymentMethodInput = {
  businessId: string;
  customerId: string;
  provider?: PaymentProvider;
  providerEnvironment: PaymentProviderEnvironment;
  paymentMethodToken?: string;
  cardSaveSourceId?: string;
  name?: string | null;
  givenName?: string | null;
  familyName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: {
    addressLine1?: string | null;
    addressLine2?: string | null;
    locality?: string | null;
    administrativeDistrictLevel1?: string | null;
    postalCode?: string | null;
    country?: "US";
  } | null;
  consentText: string;
  consentAcceptedAt: string | Date;
  customerIdempotencyKey?: string;
  paymentMethodIdempotencyKey?: string;
  verificationToken?: string | null;
};

export type SaveCustomerPaymentMethodResult = {
  customerProviderAccount: StoredCustomerProviderAccount;
  paymentMethod: StoredCustomerPaymentMethod;
};

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
  bookingHoldId?: string | null;
  bookingId?: string | null;
  bookingChargeId?: string | null;
  amountCents: number;
  currency: CurrencyCode;
  paymentMethodToken?: string;
  paymentSourceId?: string;
  providerCustomerId?: string | null;
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
