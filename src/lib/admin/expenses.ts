export type ExpenseCategory =
  | "Fuel"
  | "Vehicle maintenance"
  | "Dump fees / disposal"
  | "Payroll"
  | "Insurance"
  | "Equipment"
  | "Office / admin"
  | "Marketing"
  | "Other";

export type ExpensePaymentStatus = "Paid" | "Scheduled" | "Outstanding";
export type ExpensePaymentMethod =
  | "Card"
  | "ACH"
  | "Check"
  | "Cash"
  | "Payroll run"
  | "Other";
export type ExpenseRecurrenceFrequency = "daily" | "weekly" | "monthly" | "annually";

export type ExpenseRecord = {
  id: string;
  businessId: string;
  expenseDate: string;
  category: ExpenseCategory;
  vendor: string;
  description: string;
  amountCents: number;
  paymentStatus: ExpensePaymentStatus;
  paymentMethod: ExpensePaymentMethod;
  isRecurring: boolean;
  recurrenceFrequency: ExpenseRecurrenceFrequency | "";
  relatedAsset: string;
  taxDeductible: boolean;
  receiptReference: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
  archivedAt: string | null;
};

export type ExpenseMutationInput = {
  expenseDate: string;
  category: ExpenseCategory;
  vendor: string;
  description: string;
  amountCents: number;
  paymentStatus: ExpensePaymentStatus;
  paymentMethod: ExpensePaymentMethod;
  isRecurring: boolean;
  recurrenceFrequency: ExpenseRecurrenceFrequency | "";
  relatedAsset: string;
  taxDeductible: boolean;
  receiptReference: string;
  notes: string;
};

export type ExpenseFormErrors = Partial<Record<keyof ExpenseMutationInput, string>>;

export const expenseCategories: ExpenseCategory[] = [
  "Fuel",
  "Vehicle maintenance",
  "Dump fees / disposal",
  "Payroll",
  "Insurance",
  "Equipment",
  "Office / admin",
  "Marketing",
  "Other",
];

export const paymentStatuses: ExpensePaymentStatus[] = ["Paid", "Scheduled", "Outstanding"];
export const paymentMethods: ExpensePaymentMethod[] = ["Card", "ACH", "Check", "Cash", "Payroll run", "Other"];
export const recurrenceFrequencies: ExpenseRecurrenceFrequency[] = ["daily", "weekly", "monthly", "annually"];

function cleanText(value: string | null | undefined) {
  return value?.trim() ?? "";
}

export function createEmptyExpense(): ExpenseRecord {
  return {
    id: "",
    businessId: "",
    expenseDate: "",
    category: "Fuel",
    vendor: "",
    description: "",
    amountCents: 0,
    paymentStatus: "Paid",
    paymentMethod: "Card",
    isRecurring: false,
    recurrenceFrequency: "",
    relatedAsset: "",
    taxDeductible: true,
    receiptReference: "",
    notes: "",
    createdAt: "",
    updatedAt: "",
    createdBy: null,
    updatedBy: null,
    archivedAt: null,
  };
}

export function toExpenseMutationInput(expense: ExpenseRecord): ExpenseMutationInput {
  return {
    expenseDate: expense.expenseDate,
    category: expense.category,
    vendor: expense.vendor,
    description: expense.description,
    amountCents: expense.amountCents,
    paymentStatus: expense.paymentStatus,
    paymentMethod: expense.paymentMethod,
    isRecurring: expense.isRecurring,
    recurrenceFrequency: expense.recurrenceFrequency,
    relatedAsset: expense.relatedAsset,
    taxDeductible: expense.taxDeductible,
    receiptReference: expense.receiptReference,
    notes: expense.notes,
  };
}

export function normalizeExpenseMutationInput(input: ExpenseMutationInput): ExpenseMutationInput {
  return {
    expenseDate: cleanText(input.expenseDate),
    category: input.category,
    vendor: cleanText(input.vendor),
    description: cleanText(input.description),
    amountCents: Number.isFinite(input.amountCents) ? Math.round(input.amountCents) : 0,
    paymentStatus: input.paymentStatus,
    paymentMethod: input.paymentMethod,
    isRecurring: Boolean(input.isRecurring),
    recurrenceFrequency: input.isRecurring ? input.recurrenceFrequency : "",
    relatedAsset: cleanText(input.relatedAsset),
    taxDeductible: Boolean(input.taxDeductible),
    receiptReference: cleanText(input.receiptReference),
    notes: cleanText(input.notes),
  };
}

export function validateExpense(input: ExpenseMutationInput): ExpenseFormErrors {
  const normalized = normalizeExpenseMutationInput(input);
  const errors: ExpenseFormErrors = {};

  if (!normalized.expenseDate) errors.expenseDate = "Expense date is required.";
  if (!normalized.vendor) errors.vendor = "Vendor or payee is required.";
  if (!normalized.description) errors.description = "Description is required.";
  if (normalized.amountCents <= 0) errors.amountCents = "Amount must be greater than zero.";
  if (
    normalized.isRecurring &&
    !recurrenceFrequencies.includes(normalized.recurrenceFrequency as ExpenseRecurrenceFrequency)
  ) {
    errors.recurrenceFrequency = "Choose a recurring schedule.";
  }

  return errors;
}
