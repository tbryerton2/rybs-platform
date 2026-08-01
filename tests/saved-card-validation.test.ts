import test from "node:test";
import assert from "node:assert/strict";

import { validateUsableSavedPaymentMethod } from "../src/lib/payments/saved-card-validation.ts";

const context = {
  businessId: "business-1",
  customerId: "customer-1",
  provider: "square" as const,
  providerEnvironment: "sandbox" as const,
};

const paymentMethod = {
  id: "payment-method-1",
  business_id: "business-1",
  customer_id: "customer-1",
  provider: "square",
  provider_environment: "sandbox",
  provider_customer_id: "square-customer-1",
  provider_payment_method_id: "ccof:saved-card-1",
  status: "active",
};

test("validateUsableSavedPaymentMethod accepts a locally usable Square saved card", () => {
  const result = validateUsableSavedPaymentMethod(paymentMethod, context);

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.providerCustomerId, "square-customer-1");
    assert.equal(result.providerPaymentMethodId, "ccof:saved-card-1");
  }
});

test("validateUsableSavedPaymentMethod rejects environment and ownership mismatches locally", () => {
  assert.deepEqual(
    validateUsableSavedPaymentMethod({ ...paymentMethod, provider_environment: "production" }, context),
    {
      ok: false,
      reason: "saved_payment_method_environment_mismatch",
      paymentMethod: { ...paymentMethod, provider_environment: "production" },
    },
  );

  assert.deepEqual(
    validateUsableSavedPaymentMethod({ ...paymentMethod, customer_id: "other-customer" }, context),
    {
      ok: false,
      reason: "saved_payment_method_customer_mismatch",
      paymentMethod: { ...paymentMethod, customer_id: "other-customer" },
    },
  );
});

test("validateUsableSavedPaymentMethod requires active Square customer and card IDs", () => {
  assert.equal(
    validateUsableSavedPaymentMethod({ ...paymentMethod, status: "inactive" }, context).ok,
    false,
  );
  assert.equal(
    validateUsableSavedPaymentMethod({ ...paymentMethod, provider_customer_id: "" }, context).ok,
    false,
  );
  assert.equal(
    validateUsableSavedPaymentMethod({ ...paymentMethod, provider_payment_method_id: "" }, context).ok,
    false,
  );
});
