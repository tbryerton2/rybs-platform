import "server-only";

import { diffEntityFields, recordEntityHistory } from "@/lib/entity-history";
import { getCurrentTenant } from "@/lib/tenant/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  createEmptyExpense,
  normalizeExpenseMutationInput,
  toExpenseMutationInput,
  validateExpense,
  type ExpenseFormErrors,
  type ExpenseRecurrenceFrequency,
  type ExpenseMutationInput,
  type ExpensePaymentMethod,
  type ExpensePaymentStatus,
  type ExpenseRecord,
} from "./expenses";

type BusinessExpenseRow = {
  id: string;
  business_id: string;
  expense_date: string;
  category: string;
  vendor: string;
  description: string;
  amount_cents: number;
  status: string;
  payment_method: string;
  is_recurring: boolean;
  recurrence_frequency: string | null;
  asset_reference: string | null;
  tax_deductible: boolean;
  receipt_reference: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  archived_at: string | null;
};

export type ExpenseListFilter = {
  includeArchived?: boolean;
};

export type ExpenseMutationResult =
  | {
      ok: true;
      expense: ExpenseRecord;
      message: string;
    }
  | {
      ok: false;
      error: string;
      fieldErrors?: ExpenseFormErrors;
    };

const BUSINESS_EXPENSE_SELECT = `
  id,
  business_id,
  expense_date,
  category,
  vendor,
  description,
  amount_cents,
  status,
  payment_method,
  is_recurring,
  recurrence_frequency,
  asset_reference,
  tax_deductible,
  receipt_reference,
  notes,
  created_at,
  updated_at,
  created_by,
  updated_by,
  archived_at
`;

function cleanText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function mapRowToExpenseRecord(row: BusinessExpenseRow): ExpenseRecord {
  const empty = createEmptyExpense();

  return {
    ...empty,
    id: row.id,
    businessId: row.business_id,
    expenseDate: row.expense_date,
    category: row.category as ExpenseRecord["category"],
    vendor: row.vendor,
    description: row.description,
    amountCents: row.amount_cents,
    paymentStatus: row.status as ExpensePaymentStatus,
    paymentMethod: row.payment_method as ExpensePaymentMethod,
    isRecurring: row.is_recurring,
    recurrenceFrequency: (row.recurrence_frequency as ExpenseRecurrenceFrequency | null) ?? "",
    relatedAsset: row.asset_reference ?? "",
    taxDeductible: row.tax_deductible,
    receiptReference: row.receipt_reference ?? "",
    notes: row.notes ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    archivedAt: row.archived_at,
  };
}

function buildExpenseWriteValues(
  businessId: string,
  input: ExpenseMutationInput,
  options?: {
    actorUserId?: string | null;
  },
) {
  const normalizedInput = normalizeExpenseMutationInput(input);

  return {
    business_id: businessId,
    expense_date: normalizedInput.expenseDate,
    category: normalizedInput.category,
    vendor: normalizedInput.vendor,
    description: normalizedInput.description,
    amount_cents: normalizedInput.amountCents,
    status: normalizedInput.paymentStatus,
    payment_method: normalizedInput.paymentMethod,
    is_recurring: normalizedInput.isRecurring,
    recurrence_frequency: normalizedInput.isRecurring ? normalizedInput.recurrenceFrequency : null,
    asset_reference: cleanText(normalizedInput.relatedAsset),
    tax_deductible: normalizedInput.taxDeductible,
    receipt_reference: cleanText(normalizedInput.receiptReference),
    notes: cleanText(normalizedInput.notes),
    updated_by: options?.actorUserId ?? null,
  };
}

export async function listExpensesForCurrentBusiness(filter?: ExpenseListFilter) {
  const tenant = await getCurrentTenant();
  let query = supabaseAdmin
    .from("business_expenses")
    .select(BUSINESS_EXPENSE_SELECT)
    .eq("business_id", tenant.id)
    .order("expense_date", { ascending: false })
    .order("updated_at", { ascending: false });

  if (!filter?.includeArchived) {
    query = query.is("archived_at", null);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as BusinessExpenseRow[]).map(mapRowToExpenseRecord);
}

export async function getExpenseForCurrentBusiness(id: string) {
  const tenant = await getCurrentTenant();
  const { data, error } = await supabaseAdmin
    .from("business_expenses")
    .select(BUSINESS_EXPENSE_SELECT)
    .eq("id", id)
    .eq("business_id", tenant.id)
    .is("archived_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return mapRowToExpenseRecord(data as BusinessExpenseRow);
}

export async function createExpenseForCurrentBusiness(
  input: ExpenseMutationInput,
  actorUserId?: string | null,
): Promise<ExpenseMutationResult> {
  const tenant = await getCurrentTenant();
  const normalizedInput = normalizeExpenseMutationInput(input);
  const fieldErrors = validateExpense(normalizedInput);

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      error: "Please fix the highlighted expense fields.",
      fieldErrors,
    };
  }

  const values = {
    ...buildExpenseWriteValues(tenant.id, normalizedInput, { actorUserId }),
    created_by: actorUserId ?? null,
  };

  const { data, error } = await supabaseAdmin
    .from("business_expenses")
    .insert(values)
    .select(BUSINESS_EXPENSE_SELECT)
    .single();

  if (error || !data) {
    return {
      ok: false,
      error: error?.message ?? "Unable to create the expense right now.",
    };
  }

  const expense = mapRowToExpenseRecord(data as BusinessExpenseRow);

  await recordEntityHistory(supabaseAdmin, [
    {
      entityType: "expense",
      entityId: expense.id,
      fieldName: "__created__",
      oldValue: null,
      newValue: JSON.stringify({
        category: expense.category,
        vendor: expense.vendor,
        amountCents: expense.amountCents,
        paymentStatus: expense.paymentStatus,
      }),
      changedByType: "admin",
      changedById: actorUserId ?? null,
      changeReason: "Expense record created from admin",
    },
  ]);

  return {
    ok: true,
    expense,
    message: "Expense created.",
  };
}

export async function updateExpenseForCurrentBusiness(
  id: string,
  input: ExpenseMutationInput,
  actorUserId?: string | null,
): Promise<ExpenseMutationResult> {
  const normalizedInput = normalizeExpenseMutationInput(input);
  const fieldErrors = validateExpense(normalizedInput);

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      error: "Please fix the highlighted expense fields.",
      fieldErrors,
    };
  }

  const tenant = await getCurrentTenant();
  const currentLookup = await supabaseAdmin
    .from("business_expenses")
    .select(BUSINESS_EXPENSE_SELECT)
    .eq("id", id)
    .eq("business_id", tenant.id)
    .is("archived_at", null)
    .maybeSingle();

  if (currentLookup.error || !currentLookup.data) {
    return {
      ok: false,
      error: currentLookup.error?.message ?? "Expense not found.",
    };
  }

  const current = mapRowToExpenseRecord(currentLookup.data as BusinessExpenseRow);
  const values = buildExpenseWriteValues(tenant.id, normalizedInput, { actorUserId });

  const { data, error } = await supabaseAdmin
    .from("business_expenses")
    .update(values)
    .eq("id", id)
    .eq("business_id", tenant.id)
    .is("archived_at", null)
    .select(BUSINESS_EXPENSE_SELECT)
    .single();

  if (error || !data) {
    return {
      ok: false,
      error: error?.message ?? "Unable to update the expense right now.",
    };
  }

  const expense = mapRowToExpenseRecord(data as BusinessExpenseRow);

  await recordEntityHistory(
    supabaseAdmin,
    diffEntityFields(
      "expense",
      id,
      toExpenseMutationInput(current),
      toExpenseMutationInput(expense),
      [
        "expenseDate",
        "category",
        "vendor",
        "description",
        "amountCents",
        "paymentStatus",
        "paymentMethod",
        "isRecurring",
        "recurrenceFrequency",
        "relatedAsset",
        "taxDeductible",
        "receiptReference",
        "notes",
      ],
      {
        changedByType: "admin",
        changedById: actorUserId ?? null,
        changeReason: "Expense record updated from admin",
      },
    ),
  );

  return {
    ok: true,
    expense,
    message: "Expense updated.",
  };
}

export async function archiveExpenseForCurrentBusiness(
  id: string,
  actorUserId?: string | null,
): Promise<ExpenseMutationResult> {
  const tenant = await getCurrentTenant();
  const currentLookup = await supabaseAdmin
    .from("business_expenses")
    .select(BUSINESS_EXPENSE_SELECT)
    .eq("id", id)
    .eq("business_id", tenant.id)
    .is("archived_at", null)
    .maybeSingle();

  if (currentLookup.error || !currentLookup.data) {
    return {
      ok: false,
      error: currentLookup.error?.message ?? "Expense not found.",
    };
  }

  const { data, error } = await supabaseAdmin
    .from("business_expenses")
    .update({
      archived_at: new Date().toISOString(),
      archived_by: actorUserId ?? null,
      updated_by: actorUserId ?? null,
    })
    .eq("id", id)
    .eq("business_id", tenant.id)
    .is("archived_at", null)
    .select(BUSINESS_EXPENSE_SELECT)
    .single();

  if (error || !data) {
    return {
      ok: false,
      error: error?.message ?? "Unable to archive the expense right now.",
    };
  }

  const expense = mapRowToExpenseRecord(data as BusinessExpenseRow);

  await recordEntityHistory(supabaseAdmin, [
    {
      entityType: "expense",
      entityId: id,
      fieldName: "archivedAt",
      oldValue: null,
      newValue: expense.archivedAt,
      changedByType: "admin",
      changedById: actorUserId ?? null,
      changeReason: "Expense archived from admin",
    },
  ]);

  return {
    ok: true,
    expense,
    message: "Expense archived.",
  };
}
