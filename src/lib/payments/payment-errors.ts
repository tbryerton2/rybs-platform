const DEFAULT_CUSTOMER_PAYMENT_ERROR =
  "We could not complete your payment. Please try again or use a different card.";

const CUSTOMER_PAYMENT_ERROR_BY_CODE: Record<string, string> = {
  GENERIC_DECLINE: "Your card was declined. Please try another card or contact your bank.",
  CVV_FAILURE: "The card security code appears to be incorrect. Please check it and try again.",
  VERIFY_CVV_FAILURE: "The card security code appears to be incorrect. Please check it and try again.",
  ADDRESS_VERIFICATION_FAILURE:
    "The billing ZIP code could not be verified. Please check it and try again.",
  VERIFY_AVS_FAILURE: "The billing ZIP code could not be verified. Please check it and try again.",
  CARD_EXPIRED: "This card appears to be expired. Please use a different card.",
  INSUFFICIENT_FUNDS: "This card has insufficient funds. Please use another card.",
  PAYMENT_LIMIT_EXCEEDED:
    "This payment could not be completed because a card limit was reached. Please use another card.",
  TEMPORARY_ERROR: "Payment processing is temporarily unavailable. Please wait a moment and try again.",
  RATE_LIMITED: "Payment processing is temporarily unavailable. Please wait a moment and try again.",
};

function normalizeProviderFailureCode(value: string | null | undefined) {
  return (value || "").trim().toUpperCase();
}

function extractKnownFailureCodeFromMessage(value: string | null | undefined) {
  const message = normalizeProviderFailureCode(value);
  if (!message) return null;

  return (
    Object.keys(CUSTOMER_PAYMENT_ERROR_BY_CODE).find((code) => message.includes(code)) ?? null
  );
}

export function getCustomerFacingPaymentFailureMessage(input: {
  failureCode?: string | null;
  failureMessage?: string | null;
}) {
  const failureCode = normalizeProviderFailureCode(input.failureCode);
  const messageCode = extractKnownFailureCodeFromMessage(input.failureMessage);
  const mappedMessage =
    CUSTOMER_PAYMENT_ERROR_BY_CODE[failureCode] ||
    (messageCode ? CUSTOMER_PAYMENT_ERROR_BY_CODE[messageCode] : null);

  return mappedMessage || DEFAULT_CUSTOMER_PAYMENT_ERROR;
}
