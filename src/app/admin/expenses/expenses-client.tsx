"use client";

import { useMemo, useState } from "react";
import {
  MagnifyingGlassIcon,
  PencilSquareIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import {
  createEmptyExpense,
  createMockExpenses,
  expenseCategories,
  paymentMethods,
  paymentStatuses,
  type ExpenseRecord,
} from "@/lib/admin/expenses";

type ExpenseErrors = Partial<Record<keyof ExpenseRecord, string>>;

function formatUsdFromCents(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function formatDate(value: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  }).format(new Date(`${value}T12:00:00`));
}

function formatTimestamp(value: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  }).format(new Date(value));
}

function parseCurrencyToCents(value: string) {
  const normalized = value.replace(/[^0-9.]/g, "");
  if (!normalized) return 0;
  return Math.round(Number.parseFloat(normalized) * 100);
}

function validateExpense(expense: ExpenseRecord) {
  const errors: ExpenseErrors = {};
  if (!expense.expenseDate) errors.expenseDate = "Expense date is required.";
  if (!expense.vendor.trim()) errors.vendor = "Vendor or payee is required.";
  if (!expense.description.trim()) errors.description = "Description is required.";
  if (expense.amountCents <= 0) errors.amountCents = "Amount must be greater than zero.";
  return errors;
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 text-sm font-medium text-slate-700">{label}</div>
      {children}
      {error ? <div className="mt-1 text-xs font-medium text-rose-600">{error}</div> : null}
    </label>
  );
}

export function ExpensesClient() {
  const [expenses, setExpenses] = useState<ExpenseRecord[]>(() => createMockExpenses());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ExpenseRecord["paymentStatus"] | "All">("All");
  const [draft, setDraft] = useState<ExpenseRecord | null>(null);
  const [draftMode, setDraftMode] = useState<"create" | "edit">("create");
  const [errors, setErrors] = useState<ExpenseErrors>({});

  const filteredExpenses = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return expenses
      .filter((expense) => statusFilter === "All" || expense.paymentStatus === statusFilter)
      .filter((expense) => {
        if (!normalizedSearch) return true;
        return [
          expense.category,
          expense.vendor,
          expense.description,
          expense.relatedAsset,
          expense.receiptReference,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);
      })
      .sort((left, right) => right.expenseDate.localeCompare(left.expenseDate));
  }, [expenses, search, statusFilter]);

  const totalMonthExpenses = expenses.reduce((sum, expense) => sum + expense.amountCents, 0);
  const outstandingItems = expenses.filter((expense) => expense.paymentStatus === "Outstanding");
  const largestCategory =
    [...expenseCategories]
      .map((category) => ({
        category,
        total: expenses
          .filter((expense) => expense.category === category)
          .reduce((sum, expense) => sum + expense.amountCents, 0),
      }))
      .sort((left, right) => right.total - left.total)[0] ?? null;

  function openCreate() {
    setDraft(createEmptyExpense());
    setDraftMode("create");
    setErrors({});
  }

  function openEdit(expense: ExpenseRecord) {
    setDraft({ ...expense });
    setDraftMode("edit");
    setErrors({});
  }

  function updateDraft<K extends keyof ExpenseRecord>(key: K, value: ExpenseRecord[K]) {
    if (!draft) return;
    setDraft({ ...draft, [key]: value });
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function saveDraft() {
    if (!draft) return;
    const nextErrors = validateExpense(draft);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const now = new Date().toISOString();
    if (draftMode === "create") {
      const created = { ...draft, id: `exp_${crypto.randomUUID()}`, updatedAt: now };
      setExpenses((current) => [created, ...current]);
      setDraft({ ...created });
      setDraftMode("edit");
      return;
    }

    const saved = { ...draft, updatedAt: now };
    setExpenses((current) => current.map((expense) => (expense.id === saved.id ? saved : expense)));
    setDraft(saved);
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Monthly expenses", value: formatUsdFromCents(totalMonthExpenses), hint: "Current working set total" },
          { label: "Outstanding items", value: String(outstandingItems.length), hint: "Require payment follow-up" },
          {
            label: "Largest category",
            value: largestCategory?.category ?? "—",
            hint: largestCategory ? formatUsdFromCents(largestCategory.total) : "No expense data",
          },
          { label: "Recent entries", value: String(expenses.length), hint: "Tracked in this first version" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-slate-200/60">
            <div className="text-sm font-medium text-slate-500">{stat.label}</div>
            <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{stat.value}</div>
            <div className="mt-2 text-xs text-slate-500">{stat.hint}</div>
          </div>
        ))}
      </section>

      <section className="rounded-[32px] bg-white px-6 pb-6 pt-5 shadow-xl ring-1 ring-slate-200/70 sm:px-8 sm:pt-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">Expense register</h2>
            <p className="mt-1 text-sm text-slate-500">
              Track operating spend across fuel, maintenance, disposal, payroll, and other categories without turning this into accounting software.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreate}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#F97316] px-5 text-sm font-semibold text-white transition hover:bg-orange-600"
          >
            <PlusIcon className="h-4 w-4" />
            Add expense
          </button>
        </div>

        <div className="mt-5 flex flex-col gap-3 lg:flex-row">
          <label className="relative block flex-1">
            <span className="sr-only">Search expenses</span>
            <MagnifyingGlassIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search category, vendor, description, or asset"
              className="h-12 w-full rounded-2xl border border-slate-300 bg-white pl-11 pr-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#F97316]"
            />
          </label>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
            className="h-12 rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none focus:border-[#F97316]"
          >
            <option value="All">All statuses</option>
            {paymentStatuses.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>
      </section>

      <section className="grid gap-8 xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,0.9fr)]">
        <div className="overflow-hidden rounded-[32px] bg-white shadow-xl ring-1 ring-slate-200/70">
          <div className="border-b border-slate-200 px-6 py-5 sm:px-8">
            <div className="text-lg font-semibold tracking-tight text-slate-900">Expense records</div>
            <div className="mt-1 text-sm text-slate-500">
              {filteredExpenses.length} {filteredExpenses.length === 1 ? "entry" : "entries"}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50/80">
                <tr className="text-left">
                  <th className="px-6 py-3.5 font-semibold uppercase tracking-[0.12em] text-slate-500 sm:px-8">Date</th>
                  <th className="px-4 py-3.5 font-semibold uppercase tracking-[0.12em] text-slate-500">Category</th>
                  <th className="px-4 py-3.5 font-semibold uppercase tracking-[0.12em] text-slate-500">Vendor</th>
                  <th className="px-4 py-3.5 font-semibold uppercase tracking-[0.12em] text-slate-500">Amount</th>
                  <th className="px-4 py-3.5 font-semibold uppercase tracking-[0.12em] text-slate-500">Status</th>
                  <th className="px-4 py-3.5 font-semibold uppercase tracking-[0.12em] text-slate-500">Method</th>
                  <th className="px-6 py-3.5 font-semibold uppercase tracking-[0.12em] text-slate-500 sm:px-8">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredExpenses.map((expense) => (
                  <tr key={expense.id}>
                    <td className="px-6 py-4 text-slate-600 sm:px-8">{formatDate(expense.expenseDate)}</td>
                    <td className="px-4 py-4 text-slate-600">{expense.category}</td>
                    <td className="px-4 py-4">
                      <div className="font-semibold text-slate-900">{expense.vendor}</div>
                      <div className="mt-1 text-xs text-slate-500">{expense.description}</div>
                    </td>
                    <td className="px-4 py-4 font-semibold text-slate-900">{formatUsdFromCents(expense.amountCents)}</td>
                    <td className="px-4 py-4">
                      <span
                        className={[
                          "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                          expense.paymentStatus === "Paid"
                            ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                            : expense.paymentStatus === "Scheduled"
                              ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                              : "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
                        ].join(" ")}
                      >
                        {expense.paymentStatus}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-slate-600">{expense.paymentMethod}</td>
                    <td className="px-6 py-4 sm:px-8">
                      <button
                        type="button"
                        onClick={() => openEdit(expense)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        <PencilSquareIcon className="h-4 w-4" />
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-lg font-semibold text-slate-900">
              {draft ? (draftMode === "create" ? "Add expense" : "Edit expense") : "Expense detail"}
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {draft ? "Use a lightweight entry flow for operational finance tracking." : "Select an expense to review or add a new one."}
            </p>

            {draft ? (
              <div className="mt-6 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Expense date" error={errors.expenseDate}>
                    <input
                      type="date"
                      value={draft.expenseDate}
                      onChange={(event) => updateDraft("expenseDate", event.target.value)}
                      className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none focus:border-[#F97316]"
                    />
                  </Field>
                  <Field label="Category">
                    <select
                      value={draft.category}
                      onChange={(event) => updateDraft("category", event.target.value as ExpenseRecord["category"])}
                      className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none focus:border-[#F97316]"
                    >
                      {expenseCategories.map((category) => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Vendor / payee" error={errors.vendor}>
                    <input
                      value={draft.vendor}
                      onChange={(event) => updateDraft("vendor", event.target.value)}
                      className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none focus:border-[#F97316]"
                    />
                  </Field>
                  <Field label="Amount" error={errors.amountCents}>
                    <input
                      value={draft.amountCents ? (draft.amountCents / 100).toFixed(2) : ""}
                      onChange={(event) => updateDraft("amountCents", parseCurrencyToCents(event.target.value))}
                      className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none focus:border-[#F97316]"
                    />
                  </Field>
                  <Field label="Payment status">
                    <select
                      value={draft.paymentStatus}
                      onChange={(event) => updateDraft("paymentStatus", event.target.value as ExpenseRecord["paymentStatus"])}
                      className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none focus:border-[#F97316]"
                    >
                      {paymentStatuses.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Payment method">
                    <select
                      value={draft.paymentMethod}
                      onChange={(event) => updateDraft("paymentMethod", event.target.value as ExpenseRecord["paymentMethod"])}
                      className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none focus:border-[#F97316]"
                    >
                      {paymentMethods.map((method) => (
                        <option key={method} value={method}>{method}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Related vehicle / equipment">
                    <input
                      value={draft.relatedAsset}
                      onChange={(event) => updateDraft("relatedAsset", event.target.value)}
                      className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none focus:border-[#F97316]"
                    />
                  </Field>
                  <Field label="Receipt / invoice reference">
                    <input
                      value={draft.receiptReference}
                      onChange={(event) => updateDraft("receiptReference", event.target.value)}
                      className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none focus:border-[#F97316]"
                    />
                  </Field>
                </div>

                <Field label="Description" error={errors.description}>
                  <input
                    value={draft.description}
                    onChange={(event) => updateDraft("description", event.target.value)}
                    className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none focus:border-[#F97316]"
                  />
                </Field>

                <Field label="Notes">
                  <textarea
                    value={draft.notes}
                    onChange={(event) => updateDraft("notes", event.target.value)}
                    rows={4}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#F97316]"
                  />
                </Field>

                <label className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={draft.taxDeductible}
                    onChange={(event) => updateDraft("taxDeductible", event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-[#F97316] focus:ring-[#F97316]"
                  />
                  Mark as tax-deductible
                </label>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-6">
                  <div className="text-xs text-slate-500">
                    Last updated {draft.updatedAt ? formatTimestamp(draft.updatedAt) : "not yet saved"}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setDraft(null)}
                      className="inline-flex h-11 items-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={saveDraft}
                      className="inline-flex h-11 items-center rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      {draftMode === "create" ? "Create expense" : "Save changes"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm text-slate-600">
                Select an expense entry to review or edit it.
              </div>
            )}
          </div>

          <div className="rounded-[32px] border border-slate-200 bg-slate-50/80 p-6 shadow-sm">
            <div className="text-sm font-semibold text-slate-900">Data status</div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              This first version uses typed local mock state with a clean operational schema for future persistence, including receipt references and payment status tracking.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
