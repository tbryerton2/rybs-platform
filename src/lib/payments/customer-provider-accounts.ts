import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type {
  FindOrCreateCustomerProviderAccountInput,
  PaymentProvider,
  PaymentProviderEnvironment,
  StoredCustomerProviderAccount,
} from "./types";

const DEFAULT_PAYMENT_PROVIDER = "square" satisfies PaymentProvider;
const CUSTOMER_PROVIDER_ACCOUNT_SELECT =
  "id, business_id, customer_id, provider, provider_environment, provider_customer_id, status, created_at, updated_at";

type CustomerProviderAccountRow = {
  id: string;
  business_id: string;
  customer_id: string;
  provider: string;
  provider_environment: string;
  provider_customer_id: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export class CustomerProviderAccountServiceError extends Error {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "CustomerProviderAccountServiceError";
    this.cause = cause;
  }
}

function cleanRequired(value: string | undefined, fieldName: string) {
  const cleaned = value?.trim();
  if (!cleaned) {
    throw new CustomerProviderAccountServiceError(`${fieldName} is required.`);
  }
  return cleaned;
}

function assertUuid(value: string, fieldName: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new CustomerProviderAccountServiceError(`${fieldName} must be a valid UUID.`);
  }
}

function normalizeProvider(value: PaymentProvider | undefined) {
  return value ?? DEFAULT_PAYMENT_PROVIDER;
}

function normalizeProviderEnvironment(value: PaymentProviderEnvironment) {
  if (value !== "sandbox" && value !== "production") {
    throw new CustomerProviderAccountServiceError("providerEnvironment must be sandbox or production.");
  }
  return value;
}

function isUniqueViolation(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "23505");
}

function toStoredCustomerProviderAccount(row: CustomerProviderAccountRow): StoredCustomerProviderAccount {
  return {
    id: row.id,
    businessId: row.business_id,
    customerId: row.customer_id,
    provider: row.provider as PaymentProvider,
    providerEnvironment: row.provider_environment as PaymentProviderEnvironment,
    providerCustomerId: row.provider_customer_id,
    status: row.status as StoredCustomerProviderAccount["status"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function assertSameMapping(
  row: StoredCustomerProviderAccount,
  input: {
    businessId: string;
    customerId: string;
    provider: PaymentProvider;
    providerEnvironment: PaymentProviderEnvironment;
    providerCustomerId: string;
  },
) {
  if (
    row.businessId !== input.businessId ||
    row.customerId !== input.customerId ||
    row.provider !== input.provider ||
    row.providerEnvironment !== input.providerEnvironment
  ) {
    throw new CustomerProviderAccountServiceError(
      "providerCustomerId is already mapped to a different customer provider account.",
    );
  }

  if (row.providerCustomerId !== input.providerCustomerId) {
    throw new CustomerProviderAccountServiceError(
      "customer already has a different providerCustomerId for this provider environment.",
    );
  }
}

async function findByCustomer(input: {
  businessId: string;
  customerId: string;
  provider: PaymentProvider;
  providerEnvironment: PaymentProviderEnvironment;
}) {
  const { data, error } = await supabaseAdmin
    .from("customer_provider_accounts")
    .select(CUSTOMER_PROVIDER_ACCOUNT_SELECT)
    .eq("business_id", input.businessId)
    .eq("customer_id", input.customerId)
    .eq("provider", input.provider)
    .eq("provider_environment", input.providerEnvironment)
    .maybeSingle<CustomerProviderAccountRow>();

  if (error) {
    throw new CustomerProviderAccountServiceError(error.message, error);
  }

  return data ? toStoredCustomerProviderAccount(data) : null;
}

async function findByProviderCustomer(input: {
  provider: PaymentProvider;
  providerEnvironment: PaymentProviderEnvironment;
  providerCustomerId: string;
}) {
  const { data, error } = await supabaseAdmin
    .from("customer_provider_accounts")
    .select(CUSTOMER_PROVIDER_ACCOUNT_SELECT)
    .eq("provider", input.provider)
    .eq("provider_environment", input.providerEnvironment)
    .eq("provider_customer_id", input.providerCustomerId)
    .maybeSingle<CustomerProviderAccountRow>();

  if (error) {
    throw new CustomerProviderAccountServiceError(error.message, error);
  }

  return data ? toStoredCustomerProviderAccount(data) : null;
}

export async function findCustomerProviderAccount(input: {
  businessId: string;
  customerId: string;
  provider?: PaymentProvider;
  providerEnvironment: PaymentProviderEnvironment;
}) {
  const businessId = cleanRequired(input.businessId, "businessId");
  const customerId = cleanRequired(input.customerId, "customerId");
  assertUuid(businessId, "businessId");
  assertUuid(customerId, "customerId");

  return findByCustomer({
    businessId,
    customerId,
    provider: normalizeProvider(input.provider),
    providerEnvironment: normalizeProviderEnvironment(input.providerEnvironment),
  });
}

export async function findOrCreateCustomerProviderAccount(
  input: FindOrCreateCustomerProviderAccountInput,
) {
  const businessId = cleanRequired(input.businessId, "businessId");
  const customerId = cleanRequired(input.customerId, "customerId");
  const providerCustomerId = cleanRequired(input.providerCustomerId, "providerCustomerId");
  const provider = normalizeProvider(input.provider);
  const providerEnvironment = normalizeProviderEnvironment(input.providerEnvironment);

  assertUuid(businessId, "businessId");
  assertUuid(customerId, "customerId");

  const normalizedInput = {
    businessId,
    customerId,
    provider,
    providerEnvironment,
    providerCustomerId,
  };

  const existingByCustomer = await findByCustomer(normalizedInput);
  if (existingByCustomer) {
    assertSameMapping(existingByCustomer, normalizedInput);
    return existingByCustomer;
  }

  const existingByProviderCustomer = await findByProviderCustomer(normalizedInput);
  if (existingByProviderCustomer) {
    assertSameMapping(existingByProviderCustomer, normalizedInput);
    return existingByProviderCustomer;
  }

  const { data, error } = await supabaseAdmin
    .from("customer_provider_accounts")
    .insert({
      business_id: businessId,
      customer_id: customerId,
      provider,
      provider_environment: providerEnvironment,
      provider_customer_id: providerCustomerId,
      status: "active",
    })
    .select(CUSTOMER_PROVIDER_ACCOUNT_SELECT)
    .single<CustomerProviderAccountRow>();

  if (error || !data) {
    if (isUniqueViolation(error)) {
      const racedByCustomer = await findByCustomer(normalizedInput);
      if (racedByCustomer) {
        assertSameMapping(racedByCustomer, normalizedInput);
        return racedByCustomer;
      }

      const racedByProviderCustomer = await findByProviderCustomer(normalizedInput);
      if (racedByProviderCustomer) {
        assertSameMapping(racedByProviderCustomer, normalizedInput);
        return racedByProviderCustomer;
      }
    }

    throw new CustomerProviderAccountServiceError(
      error?.message ?? "Unable to create customer provider account.",
      error,
    );
  }

  return toStoredCustomerProviderAccount(data);
}
