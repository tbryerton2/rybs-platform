import "server-only";

import { createSquarePaymentAdapter } from "./square";
import type { PaymentProvider, PaymentProviderAdapter } from "../types";

export function getPaymentProviderAdapter(provider: PaymentProvider): PaymentProviderAdapter {
  switch (provider) {
    case "square":
      return createSquarePaymentAdapter();
    default: {
      const exhaustiveProvider: never = provider;
      throw new Error(`Unsupported payment provider: ${exhaustiveProvider}`);
    }
  }
}
