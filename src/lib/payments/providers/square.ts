import "server-only";

import { SquareClient, SquareEnvironment, SquareError } from "square";
import type { Currency } from "square";
import type {
  PaymentProviderAdapter,
  PaymentProviderChargeInput,
  PaymentProviderChargeResult,
  PaymentProviderEnvironment,
  PaymentStatus,
} from "../types";

function resolveSquareEnvironment(): PaymentProviderEnvironment {
  const raw = (process.env.SQUARE_ENVIRONMENT || "sandbox").trim().toLowerCase();

  if (raw === "production") return "production";
  if (raw === "sandbox") return "sandbox";

  throw new Error("SQUARE_ENVIRONMENT must be either 'sandbox' or 'production'.");
}

function resolveSquareBaseUrl(environment: PaymentProviderEnvironment) {
  return environment === "production" ? SquareEnvironment.Production : SquareEnvironment.Sandbox;
}

function getSquareAccessToken() {
  const token = process.env.SQUARE_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new Error("SQUARE_ACCESS_TOKEN is required for Square checkout payments.");
  }
  return token;
}

function getSquareLocationId() {
  const locationId = process.env.SQUARE_LOCATION_ID?.trim();
  if (!locationId) {
    throw new Error("SQUARE_LOCATION_ID is required for Square checkout payments. Add it to .env.local.");
  }
  return locationId;
}

function createSquareClient(environment: PaymentProviderEnvironment) {
  return new SquareClient({
    environment: resolveSquareBaseUrl(environment),
    token: getSquareAccessToken(),
  });
}

function mapSquareStatus(status: string | null | undefined): PaymentStatus {
  switch ((status || "").toUpperCase()) {
    case "COMPLETED":
      return "paid";
    case "FAILED":
      return "failed";
    case "CANCELED":
    case "CANCELLED":
      return "canceled";
    case "APPROVED":
    case "PENDING":
    default:
      return "pending";
  }
}

function firstSquareErrorMessage(errors: Array<{ code?: string; detail?: string }> | undefined) {
  const first = errors?.[0];
  return {
    code: first?.code ?? null,
    message: first?.detail ?? null,
  };
}

function extractSquareError(error: unknown) {
  if (error instanceof SquareError) {
    const first = error.errors?.[0];
    return {
      code: first?.code ?? String(error.statusCode ?? "SQUARE_ERROR"),
      message: first?.detail ?? (error.message || "Square payment failed."),
      raw: error.body ?? { message: error.message, statusCode: error.statusCode, errors: error.errors },
    };
  }

  if (error instanceof Error) {
    return {
      code: "SQUARE_ERROR",
      message: error.message || "Square payment failed.",
      raw: { message: error.message },
    };
  }

  return {
    code: "SQUARE_ERROR",
    message: "Square payment failed.",
    raw: { error },
  };
}

export function createSquarePaymentAdapter(): PaymentProviderAdapter {
  const environment = resolveSquareEnvironment();

  return {
    provider: "square",
    environment,
    async charge(input: PaymentProviderChargeInput): Promise<PaymentProviderChargeResult> {
      const locationId = getSquareLocationId();
      const client = createSquareClient(environment);

      try {
        const response = await client.payments.create({
          sourceId: input.paymentMethodToken,
          idempotencyKey: input.idempotencyKey,
          amountMoney: {
            amount: BigInt(input.amountCents),
            currency: input.currency as Currency,
          },
          autocomplete: true,
          locationId,
          referenceId: input.paymentId,
          note: input.description,
        });

        const payment = response.payment;
        const status = mapSquareStatus(payment?.status);
        const squareError = firstSquareErrorMessage(response.errors);
        const failedAt = status === "failed" || status === "canceled" ? new Date().toISOString() : null;

        return {
          status,
          providerPaymentId: payment?.id ?? null,
          providerOrderId: payment?.orderId ?? null,
          providerLocationId: payment?.locationId ?? locationId,
          rawProviderResponse: response,
          paidAt: status === "paid" ? payment?.updatedAt ?? new Date().toISOString() : null,
          failedAt,
          failureCode: status === "failed" || status === "canceled" ? squareError.code ?? status : null,
          failureMessage:
            status === "failed" || status === "canceled"
              ? squareError.message ?? `Square payment ${status}.`
              : null,
        };
      } catch (error) {
        const squareError = extractSquareError(error);

        return {
          status: "failed",
          providerLocationId: locationId,
          rawProviderResponse: squareError.raw,
          failedAt: new Date().toISOString(),
          failureCode: squareError.code,
          failureMessage: squareError.message,
        };
      }
    },
  };
}
