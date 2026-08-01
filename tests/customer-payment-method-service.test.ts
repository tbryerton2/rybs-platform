import test from "node:test";
import assert from "node:assert/strict";

import {
  saveCustomerPaymentMethod,
  SaveCustomerPaymentMethodError,
} from "../src/lib/payments/customer-payment-method-service.ts";
import type {
  PaymentProviderSavePaymentMethodResult,
  PersistCustomerPaymentMethodInput,
  StoredCustomerPaymentMethod,
  StoredCustomerProviderAccount,
} from "../src/lib/payments/types.ts";

const BUSINESS_ID = "11111111-1111-4111-8111-111111111111";
const CUSTOMER_ID = "22222222-2222-4222-8222-222222222222";
const PROVIDER_ACCOUNT_ID = "33333333-3333-4333-8333-333333333333";
const PAYMENT_METHOD_ID = "44444444-4444-4444-8444-444444444444";
const ACCEPTED_AT = "2026-07-30T12:00:00.000Z";

function baseInput() {
  return {
    businessId: BUSINESS_ID,
    customerId: CUSTOMER_ID,
    provider: "square" as const,
    providerEnvironment: "sandbox" as const,
    cardSaveSourceId: "payment-id-redacted",
    name: "Taylor Morgan",
    email: "taylor@example.com",
    phone: "555-0100",
    consentText: "I authorize saved-card charges.",
    consentAcceptedAt: ACCEPTED_AT,
    customerIdempotencyKey: `cof-customer-${CUSTOMER_ID}`,
    paymentMethodIdempotencyKey: "cof-card-booking-1",
  };
}

function providerAccount(): StoredCustomerProviderAccount {
  return {
    id: PROVIDER_ACCOUNT_ID,
    businessId: BUSINESS_ID,
    customerId: CUSTOMER_ID,
    provider: "square",
    providerEnvironment: "sandbox",
    providerCustomerId: "square-customer-1",
    status: "active",
    createdAt: ACCEPTED_AT,
    updatedAt: ACCEPTED_AT,
  };
}

function providerCard(id = "ccof:saved-card-1"): PaymentProviderSavePaymentMethodResult {
  return {
    provider: "square",
    providerEnvironment: "sandbox",
    providerCustomerId: "square-customer-1",
    providerPaymentMethodId: id,
    cardBrand: "VISA",
    cardLast4: "1111",
    cardExpMonth: 12,
    cardExpYear: 2030,
  };
}

function storedPaymentMethod(
  input: PersistCustomerPaymentMethodInput,
  id = PAYMENT_METHOD_ID,
): StoredCustomerPaymentMethod {
  return {
    id,
    businessId: input.businessId,
    customerId: input.customerId,
    customerProviderAccountId: input.customerProviderAccountId ?? null,
    provider: "square",
    providerEnvironment: input.providerEnvironment,
    providerCustomerId: input.providerCustomerId,
    providerPaymentMethodId: input.providerPaymentMethodId,
    cardBrand: input.cardBrand ?? null,
    cardLast4: input.cardLast4 ?? null,
    cardExpMonth: input.cardExpMonth ?? null,
    cardExpYear: input.cardExpYear ?? null,
    status: "active",
    consentText: input.consentText ?? null,
    consentAcceptedAt: typeof input.consentAcceptedAt === "string" ? input.consentAcceptedAt : null,
    createdAt: ACCEPTED_AT,
    updatedAt: ACCEPTED_AT,
  };
}

test("saveCustomerPaymentMethod succeeds when Square customer, card, validation, and persistence succeed", async () => {
  let savedCardCalls = 0;
  let persistedInput: PersistCustomerPaymentMethodInput | null = null;

  const result = await saveCustomerPaymentMethod(baseInput(), {
    createOrReuseProviderCustomer: async () => ({
      provider: "square",
      providerEnvironment: "sandbox",
      providerCustomerId: "square-customer-1",
      reused: false,
    }),
    findOrCreateProviderAccount: async () => providerAccount(),
    findReusableProviderPaymentMethod: async () => null,
    saveProviderPaymentMethod: async () => {
      savedCardCalls += 1;
      return providerCard();
    },
    verifyProviderPaymentMethod: async () => ({ ok: true }),
    persistPaymentMethod: async (input) => {
      persistedInput = input;
      return storedPaymentMethod(input);
    },
  });

  assert.equal(savedCardCalls, 1);
  assert.equal(result.paymentMethod.providerPaymentMethodId, "ccof:saved-card-1");
  assert.equal(persistedInput?.providerCustomerId, "square-customer-1");
});

test("saveCustomerPaymentMethod reports Square customer creation failures with a durable stage", async () => {
  await assert.rejects(
    () =>
      saveCustomerPaymentMethod(baseInput(), {
        createOrReuseProviderCustomer: async () => {
          throw new Error("Square customer create failed");
        },
      }),
    (error) =>
      error instanceof SaveCustomerPaymentMethodError &&
      error.failureStage === "creating_square_customer" &&
      error.safeErrorCode === "SQUARE_CUSTOMER_SAVE_FAILED" &&
      error.retryable === true,
  );
});

test("saveCustomerPaymentMethod reports Square card creation failures with a durable stage", async () => {
  await assert.rejects(
    () =>
      saveCustomerPaymentMethod(baseInput(), {
        createOrReuseProviderCustomer: async () => ({
          provider: "square",
          providerEnvironment: "sandbox",
          providerCustomerId: "square-customer-1",
          reused: true,
        }),
        findOrCreateProviderAccount: async () => providerAccount(),
        findReusableProviderPaymentMethod: async () => null,
        saveProviderPaymentMethod: async () => {
          throw new Error("Square card save failed");
        },
      }),
    (error) =>
      error instanceof SaveCustomerPaymentMethodError &&
      error.failureStage === "saving_square_card" &&
      error.safeErrorCode === "SQUARE_CARD_SAVE_FAILED" &&
      error.retryable === true,
  );
});

test("saveCustomerPaymentMethod reports local payment-method persistence failures with a durable stage", async () => {
  await assert.rejects(
    () =>
      saveCustomerPaymentMethod(baseInput(), {
        createOrReuseProviderCustomer: async () => ({
          provider: "square",
          providerEnvironment: "sandbox",
          providerCustomerId: "square-customer-1",
          reused: true,
        }),
        findOrCreateProviderAccount: async () => providerAccount(),
        findReusableProviderPaymentMethod: async () => null,
        saveProviderPaymentMethod: async () => providerCard(),
        verifyProviderPaymentMethod: async () => ({ ok: true }),
        persistPaymentMethod: async () => {
          throw new Error("database unavailable");
        },
      }),
    (error) =>
      error instanceof SaveCustomerPaymentMethodError &&
      error.failureStage === "writing_customer_payment_methods" &&
      error.safeErrorCode === "CUSTOMER_PAYMENT_METHOD_PERSIST_FAILED" &&
      error.retryable === true,
  );
});

test("saveCustomerPaymentMethod reuses an existing Square card after an initial local insert failure", async () => {
  let saveCardCalls = 0;
  let persistCalls = 0;
  let reusableCardAvailable = false;

  const options = {
    createOrReuseProviderCustomer: async () => ({
      provider: "square" as const,
      providerEnvironment: "sandbox" as const,
      providerCustomerId: "square-customer-1",
      reused: true,
    }),
    findOrCreateProviderAccount: async () => providerAccount(),
    findReusableProviderPaymentMethod: async () => (reusableCardAvailable ? providerCard() : null),
    saveProviderPaymentMethod: async () => {
      saveCardCalls += 1;
      reusableCardAvailable = true;
      return providerCard();
    },
    verifyProviderPaymentMethod: async () => ({ ok: true }),
    persistPaymentMethod: async (input: PersistCustomerPaymentMethodInput) => {
      persistCalls += 1;
      if (persistCalls === 1) {
        throw new Error("database unavailable");
      }

      return storedPaymentMethod(input);
    },
  };

  await assert.rejects(() => saveCustomerPaymentMethod(baseInput(), options));
  const retryResult = await saveCustomerPaymentMethod(baseInput(), options);

  assert.equal(saveCardCalls, 1);
  assert.equal(persistCalls, 2);
  assert.equal(retryResult.paymentMethod.providerPaymentMethodId, "ccof:saved-card-1");
});
