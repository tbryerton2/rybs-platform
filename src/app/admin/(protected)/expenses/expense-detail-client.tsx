"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminToast } from "@/app/admin/_components/admin/admin-toast";
import {
  createEmptyExpense,
  expenseCategories,
  normalizeExpenseMutationInput,
  paymentMethods,
  paymentStatuses,
  recurrenceFrequencies,
  toExpenseMutationInput,
  validateExpense,
  type ExpenseFormErrors,
  type ExpenseRecord,
} from "@/lib/admin/expenses";
import { createExpenseAction, updateExpenseAction } from "./actions";

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

type ExpenseDetailClientProps = {
  mode: "create" | "edit";
  initialExpense?: ExpenseRecord | null;
};

export function ExpenseDetailClient({ mode, initialExpense }: ExpenseDetailClientProps) {
  const router = useRouter();
  const startingExpense = initialExpense ?? createEmptyExpense();
  const [savedExpense, setSavedExpense] = useState<ExpenseRecord>(startingExpense);
  const [draft, setDraft] = useState<ExpenseRecord>(startingExpense);
  const [errors, setErrors] = useState<ExpenseFormErrors>({});
  const [panelError, setPanelError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isCreateMode = mode === "create";
  const heading = isCreateMode ? "Add expense" : "Edit expense";
  const hasUnsavedChanges =
    JSON.stringify(normalizeExpenseMutationInput(toExpenseMutationInput(draft))) !==
    JSON.stringify(normalizeExpenseMutationInput(toExpenseMutationInput(savedExpense)));

  function updateDraft<K extends keyof ExpenseRecord>(key: K, value: ExpenseRecord[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key as keyof ExpenseFormErrors]: undefined }));
    setPanelError(null);
  }

  function resetDraft() {
    if (isCreateMode) {
      router.push("/admin/expenses");
      return;
    }

    setDraft(savedExpense);
    setErrors({});
    setPanelError(null);
  }

  function saveDraft() {
    const payload = normalizeExpenseMutationInput(toExpenseMutationInput(draft));
    const nextErrors = validateExpense(payload);

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setPanelError("Please review the highlighted expense fields before saving.");
      adminToast.error("Please review the expense form.");
      return;
    }

    startTransition(async () => {
      const result = isCreateMode
        ? await createExpenseAction(payload)
        : await updateExpenseAction(draft.id, payload);

      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        setPanelError(result.error);
        adminToast.error(result.error);
        return;
      }

      setSavedExpense(result.expense);
      setDraft(result.expense);
      setErrors({});
      setPanelError(null);

      if (isCreateMode) {
        router.push(`/admin/expenses/${result.expense.id}?saved=created`);
        return;
      }

      router.replace(`/admin/expenses/${result.expense.id}?saved=updated`);
    });
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        {!isCreateMode ? (
          <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Expense Details</div>
        ) : (
          <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">New Expense</div>
        )}

        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">{heading}</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600">
              <span>{draft.category || "Choose a category"}</span>
              <span className="text-slate-300" aria-hidden="true">
                |
              </span>
              <span>{draft.vendor || "Add a vendor"}</span>
              <span className="text-slate-300" aria-hidden="true">
                |
              </span>
              <span>{draft.paymentStatus}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 xl:justify-end">
            {hasUnsavedChanges ? (
              <button
                type="button"
                onClick={resetDraft}
                disabled={isPending}
                className="inline-flex h-10 items-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-50"
              >
                {isCreateMode ? "Cancel" : "Reset changes"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={saveDraft}
              disabled={isPending}
              className="inline-flex h-10 items-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isPending ? "Saving..." : isCreateMode ? "Create expense" : "Save changes"}
            </button>
          </div>
        </div>
      </section>

      {panelError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {panelError}
        </div>
      ) : null}

      <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Expense date" error={errors.expenseDate}>
            <input
              type="date"
              value={draft.expenseDate}
              disabled={isPending}
              onChange={(event) => updateDraft("expenseDate", event.target.value)}
              className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none focus:border-[#F97316] disabled:cursor-not-allowed disabled:bg-slate-50"
            />
          </Field>
          <Field label="Category">
            <select
              value={draft.category}
              disabled={isPending}
              onChange={(event) => updateDraft("category", event.target.value as ExpenseRecord["category"])}
              className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none focus:border-[#F97316] disabled:cursor-not-allowed disabled:bg-slate-50"
            >
              {expenseCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Vendor / payee" error={errors.vendor}>
            <input
              value={draft.vendor}
              disabled={isPending}
              onChange={(event) => updateDraft("vendor", event.target.value)}
              className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none focus:border-[#F97316] disabled:cursor-not-allowed disabled:bg-slate-50"
            />
          </Field>
          <Field label="Amount" error={errors.amountCents}>
            <input
              value={draft.amountCents ? (draft.amountCents / 100).toFixed(2) : ""}
              disabled={isPending}
              onChange={(event) => updateDraft("amountCents", parseCurrencyToCents(event.target.value))}
              className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none focus:border-[#F97316] disabled:cursor-not-allowed disabled:bg-slate-50"
            />
          </Field>
          <Field label="Payment status">
            <select
              value={draft.paymentStatus}
              disabled={isPending}
              onChange={(event) => updateDraft("paymentStatus", event.target.value as ExpenseRecord["paymentStatus"])}
              className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none focus:border-[#F97316] disabled:cursor-not-allowed disabled:bg-slate-50"
            >
              {paymentStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Payment method">
            <select
              value={draft.paymentMethod}
              disabled={isPending}
              onChange={(event) => updateDraft("paymentMethod", event.target.value as ExpenseRecord["paymentMethod"])}
              className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none focus:border-[#F97316] disabled:cursor-not-allowed disabled:bg-slate-50"
            >
              {paymentMethods.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Recurring schedule" error={errors.recurrenceFrequency}>
            <div className="space-y-3">
              <label className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={draft.isRecurring}
                  disabled={isPending}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    updateDraft("isRecurring", checked);
                    updateDraft("recurrenceFrequency", checked ? "monthly" : "");
                  }}
                  className="h-4 w-4 rounded border-slate-300 text-[#F97316] focus:ring-[#F97316]"
                />
                Recurring expense
              </label>

              {draft.isRecurring ? (
                <select
                  value={draft.recurrenceFrequency}
                  disabled={isPending}
                  onChange={(event) =>
                    updateDraft("recurrenceFrequency", event.target.value as ExpenseRecord["recurrenceFrequency"])
                  }
                  className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none focus:border-[#F97316] disabled:cursor-not-allowed disabled:bg-slate-50"
                >
                  {recurrenceFrequencies.map((frequency) => (
                    <option key={frequency} value={frequency}>
                      {frequency.charAt(0).toUpperCase() + frequency.slice(1)}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
          </Field>
          <Field label="Related vehicle / equipment">
            <input
              value={draft.relatedAsset}
              disabled={isPending}
              onChange={(event) => updateDraft("relatedAsset", event.target.value)}
              className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none focus:border-[#F97316] disabled:cursor-not-allowed disabled:bg-slate-50"
            />
          </Field>
          <Field label="Receipt / invoice reference">
            <input
              value={draft.receiptReference}
              disabled={isPending}
              onChange={(event) => updateDraft("receiptReference", event.target.value)}
              className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none focus:border-[#F97316] disabled:cursor-not-allowed disabled:bg-slate-50"
            />
          </Field>
        </div>

        <div className="mt-4 space-y-4">
          <Field label="Description" error={errors.description}>
            <input
              value={draft.description}
              disabled={isPending}
              onChange={(event) => updateDraft("description", event.target.value)}
              className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none focus:border-[#F97316] disabled:cursor-not-allowed disabled:bg-slate-50"
            />
          </Field>

          <Field label="Notes">
            <textarea
              value={draft.notes}
              disabled={isPending}
              onChange={(event) => updateDraft("notes", event.target.value)}
              rows={4}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#F97316] disabled:cursor-not-allowed disabled:bg-slate-50"
            />
          </Field>

          <label className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={draft.taxDeductible}
              disabled={isPending}
              onChange={(event) => updateDraft("taxDeductible", event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-[#F97316] focus:ring-[#F97316]"
            />
            Mark as tax-deductible
          </label>
        </div>
      </section>

      {!isCreateMode ? (
        <section className="rounded-[32px] border border-slate-200 bg-slate-50/80 p-6 shadow-sm">
          <div className="text-sm font-semibold text-slate-900">Record status</div>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Last updated {draft.updatedAt ? formatTimestamp(draft.updatedAt) : "not yet saved"}.
          </p>
        </section>
      ) : null}
    </div>
  );
}
