import "server-only";

import { createSquarePaymentAdapter } from "./square";
import { resolveTenantPaymentProviderConnection } from "../tenant-payment-provider-connections";
import type {
  PaymentProvider,
  PaymentProviderAdapter,
  PaymentProviderConnectionContext,
} from "../types";

export function getPaymentProviderAdapter(
  provider: PaymentProvider,
  options: { connection?: PaymentProviderConnectionContext } = {},
): PaymentProviderAdapter {
  switch (provider) {
    case "square":
      return createSquarePaymentAdapter(options.connection);
    default: {
      const exhaustiveProvider: never = provider;
      throw new Error(`Unsupported payment provider: ${exhaustiveProvider}`);
    }
  }
}

export async function getPaymentProviderAdapterForBusiness(input: {
  provider: PaymentProvider;
  businessId: string;
  paymentProviderConnectionId?: string | null;
}, options: Parameters<typeof resolveTenantPaymentProviderConnection>[1] = {}) {
  const connection = await resolveTenantPaymentProviderConnection({
    businessId: input.businessId,
    provider: input.provider,
    paymentProviderConnectionId: input.paymentProviderConnectionId,
  }, options);

  return getPaymentProviderAdapter(input.provider, { connection });
}
