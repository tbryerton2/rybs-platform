import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";

import { findOrCreateCustomerRecord } from "../src/lib/customers.ts";

type MockRow = Record<string, unknown>;
type MockError = { code?: string; message: string };

function normalizeEmail(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase();
  return normalized || null;
}

class MockSupabase {
  tables: Record<string, MockRow[]>;
  customerInsertCount = 0;
  failNextCustomerInsertWithScopedUnique = false;
  raceCustomerRow: MockRow | null = null;

  constructor(tables: Record<string, MockRow[]>) {
    this.tables = tables;
  }

  from(table: string) {
    return new MockQuery(this, table);
  }
}

class MockQuery {
  private operation: "select" | "insert" | "update" = "select";
  private payload: MockRow | MockRow[] | null = null;
  private filters: Array<(row: MockRow) => boolean> = [];
  private maxRows: number | null = null;
  private readonly supabase: MockSupabase;
  private readonly table: string;

  constructor(supabase: MockSupabase, table: string) {
    this.supabase = supabase;
    this.table = table;
  }

  select() {
    return this;
  }

  insert(payload: MockRow | MockRow[]) {
    this.operation = "insert";
    this.payload = payload;
    return this;
  }

  update(payload: MockRow) {
    this.operation = "update";
    this.payload = payload;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  ilike(column: string, value: string) {
    const expected = value.replaceAll("%", "").toLowerCase();
    this.filters.push((row) => String(row[column] ?? "").toLowerCase() === expected);
    return this;
  }

  not(column: string, operator: string, value: unknown) {
    if (operator === "is" && value === null) {
      this.filters.push((row) => row[column] !== null && row[column] !== undefined);
    }
    return this;
  }

  limit(count: number) {
    this.maxRows = count;
    return this;
  }

  order() {
    return this;
  }

  async maybeSingle() {
    const result = await this.execute();
    if (result.error) return result;
    return { data: result.data?.[0] ?? null, error: null };
  }

  async single() {
    const result = await this.execute();
    if (result.error) return result;
    return { data: result.data?.[0] ?? null, error: null };
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: { data: MockRow[] | null; error: MockError | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute() {
    if (this.operation === "insert") return this.executeInsert();
    if (this.operation === "update") return this.executeUpdate();
    return this.executeSelect();
  }

  private async executeSelect() {
    const rows = (this.supabase.tables[this.table] ?? []).filter((row) =>
      this.filters.every((filter) => filter(row)),
    );

    return {
      data: this.maxRows === null ? rows : rows.slice(0, this.maxRows),
      error: null,
    };
  }

  private async executeInsert() {
    const rows = Array.isArray(this.payload) ? this.payload : [this.payload ?? {}];

    if (this.table === "customers") {
      this.supabase.customerInsertCount += rows.length;

      if (this.supabase.failNextCustomerInsertWithScopedUnique) {
        this.supabase.failNextCustomerInsertWithScopedUnique = false;
        if (this.supabase.raceCustomerRow) {
          this.supabase.tables.customers.push(this.supabase.raceCustomerRow);
        }
        return {
          data: null,
          error: {
            code: "23505",
            message:
              'duplicate key value violates unique constraint "customers_business_id_normalized_email_key"',
          },
        };
      }

      for (const row of rows) {
        const normalized = normalizeEmail(typeof row.email === "string" ? row.email : null);
        const duplicate = this.supabase.tables.customers.some(
          (customer) =>
            customer.business_id === row.business_id &&
            customer.normalized_email === normalized,
        );
        if (duplicate) {
          return {
            data: null,
            error: {
              code: "23505",
              message:
                'duplicate key value violates unique constraint "customers_business_id_normalized_email_key"',
            },
          };
        }
      }
    }

    const insertedRows = rows.map((row) => ({
      id: row.id ?? `${this.table}-${this.supabase.tables[this.table].length + 1}`,
      ...row,
      normalized_email:
        this.table === "customers"
          ? normalizeEmail(typeof row.email === "string" ? row.email : null)
          : row.normalized_email,
    }));

    this.supabase.tables[this.table].push(...insertedRows);
    return { data: insertedRows, error: null };
  }

  private async executeUpdate() {
    const rows = this.supabase.tables[this.table] ?? [];
    for (const row of rows) {
      if (this.filters.every((filter) => filter(row))) {
        Object.assign(row, this.payload);
      }
    }
    return { data: null, error: null };
  }
}

function createCustomer(overrides: MockRow) {
  return {
    id: "customer-1",
    business_id: "tan-business",
    name: "Existing Customer",
    email: "shared@example.com",
    normalized_email: "shared@example.com",
    phone: "5551112222",
    primary_street: null,
    primary_city: null,
    primary_state: null,
    primary_zip: null,
    portal_status: "invited",
    ...overrides,
  };
}

function createMockSupabase(customers: MockRow[]) {
  return new MockSupabase({
    customers,
    customer_locations: [],
    entity_history: [],
  });
}

test("customer email uniqueness repair migration is scoped by business and drops the global key", () => {
  const migration = readFileSync(
    resolve(
      import.meta.dirname,
      "../supabase/migrations/202608180101_repair_customer_email_tenant_uniqueness.sql",
    ),
    "utf8",
  );

  assert.match(migration, /on public\.customers \(business_id, normalized_email\)/);
  assert.match(migration, /where normalized_email is not null/);
  assert.match(migration, /drop constraint customers_normalized_email_key/);
  assert.match(migration, /drop index public\.customers_normalized_email_key/);
  assert.doesNotMatch(migration, /on public\.customers \(normalized_email\)/);
});

test("findOrCreateCustomerRecord reuses an existing customer only within the same tenant", async () => {
  const supabase = createMockSupabase([
    createCustomer({ id: "tan-customer", business_id: "tan-business" }),
    createCustomer({ id: "demo-customer", business_id: "demo-business" }),
  ]);

  const customerId = await findOrCreateCustomerRecord(
    {
      fullName: "Demo Customer",
      email: "SHARED@example.com",
      phone: "555-111-2222",
    },
    supabase as unknown as SupabaseClient,
    "demo-business",
  );

  assert.equal(customerId, "demo-customer");
  assert.equal(supabase.customerInsertCount, 0);
});

test("findOrCreateCustomerRecord allows the same normalized email in another tenant", async () => {
  const supabase = createMockSupabase([
    createCustomer({ id: "tan-customer", business_id: "tan-business" }),
  ]);

  const customerId = await findOrCreateCustomerRecord(
    {
      fullName: "Demo Customer",
      email: "shared@example.com",
      phone: "555-222-3333",
    },
    supabase as unknown as SupabaseClient,
    "demo-business",
  );

  assert.notEqual(customerId, "tan-customer");
  assert.equal(supabase.customerInsertCount, 1);
  assert.equal(
    supabase.tables.customers.some(
      (customer) =>
        customer.id === customerId &&
        customer.business_id === "demo-business" &&
        customer.normalized_email === "shared@example.com",
    ),
    true,
  );
});

test("findOrCreateCustomerRecord reselects same-tenant customers after a scoped unique insert race", async () => {
  const supabase = createMockSupabase([]);
  supabase.failNextCustomerInsertWithScopedUnique = true;
  supabase.raceCustomerRow = createCustomer({
    id: "demo-race-customer",
    business_id: "demo-business",
    name: "Race Customer",
  });

  const customerId = await findOrCreateCustomerRecord(
    {
      fullName: "Race Customer",
      email: "shared@example.com",
      phone: "555-333-4444",
    },
    supabase as unknown as SupabaseClient,
    "demo-business",
  );

  assert.equal(customerId, "demo-race-customer");
  assert.equal(supabase.customerInsertCount, 1);
});
