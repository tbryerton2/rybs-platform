"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import {
  BanknotesIcon,
  ChartBarSquareIcon,
  ChevronRightIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  ReceiptPercentIcon,
} from "@heroicons/react/24/outline";
import { adminSummaryCardShell } from "@/app/admin/_components/AdminSummaryCard";
import { AdminPageHeader } from "@/app/admin/_components/admin/admin-page";
import { ClickableTableRow } from "@/app/admin/analytics/zip-heatmap/clickable-table-row";
import {
  expenseCategories,
  paymentStatuses,
  type ExpenseRecord,
} from "@/lib/admin/expenses";

type ExpensesClientProps = {
  initialExpenses: ExpenseRecord[];
  loadError: string | null;
};

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

export function ExpensesClient({ initialExpenses, loadError }: ExpensesClientProps) {
  const [savedExpenses] = useState<ExpenseRecord[]>(initialExpenses);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ExpenseRecord["paymentStatus"] | "All">("All");
  const deferredSearch = useDeferredValue(search);

  const filteredExpenses = useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase();

    return savedExpenses
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
      .sort((left, right) => {
        const dateCompare = right.expenseDate.localeCompare(left.expenseDate);
        if (dateCompare !== 0) return dateCompare;
        return right.updatedAt.localeCompare(left.updatedAt);
      });
  }, [deferredSearch, savedExpenses, statusFilter]);

  const totalMonthExpenses = savedExpenses.reduce((sum, expense) => sum + expense.amountCents, 0);
  const outstandingItems = savedExpenses.filter((expense) => expense.paymentStatus === "Outstanding");
  const largestCategory =
    [...expenseCategories]
      .map((category) => ({
        category,
        total: savedExpenses
          .filter((expense) => expense.category === category)
          .reduce((sum, expense) => sum + expense.amountCents, 0),
      }))
      .sort((left, right) => right.total - left.total)[0] ?? null;

  const summaryCards = [
    {
      label: "Monthly expenses",
      value: formatUsdFromCents(totalMonthExpenses),
      icon: BanknotesIcon,
      cardClassName: adminSummaryCardShell("amber", "h-full p-5"),
      iconClassName: "bg-amber-100/95 text-amber-700 ring-amber-200/90",
    },
    {
      label: "Outstanding items",
      value: String(outstandingItems.length),
      icon: ClockIcon,
      cardClassName: adminSummaryCardShell("rose", "h-full p-5"),
      iconClassName: "bg-rose-100/95 text-rose-700 ring-rose-200/90",
    },
    {
      label: "Largest category",
      value: largestCategory?.category ?? "—",
      icon: ChartBarSquareIcon,
      cardClassName: adminSummaryCardShell("violet", "h-full p-5"),
      iconClassName: "bg-violet-100/95 text-violet-700 ring-violet-200/90",
    },
    {
      label: "Recent expenses",
      value: String(savedExpenses.length),
      icon: ReceiptPercentIcon,
      cardClassName: adminSummaryCardShell("green", "h-full p-5"),
      iconClassName: "bg-emerald-100/95 text-emerald-700 ring-emerald-200/90",
    },
  ] as const;

  const hasSearch = search.trim().length > 0;
  const hasNoExpenses = savedExpenses.length === 0;

  function clearFilters() {
    setSearch("");
    setStatusFilter("All");
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Expenses"
        actions={
          <Link
            href="/admin/expenses/new"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#F97316] px-5 text-sm font-semibold text-white transition hover:bg-orange-600"
          >
            <PlusIcon className="h-4 w-4" />
            Add expense
          </Link>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((stat) => (
          <div
            key={stat.label}
            className={stat.cardClassName}
          >
            <div className="flex gap-4">
              <div className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/65 ring-1 ring-inset ${stat.iconClassName}`}>
                <stat.icon className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <div className="flex h-12 items-center text-sm font-medium leading-5 text-slate-600">{stat.label}</div>
                <div className="mt-2 text-lg font-semibold tracking-tight text-slate-950">
                  {stat.value}
                </div>
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-[32px] bg-white px-6 pb-6 pt-5 shadow-xl ring-1 ring-slate-200/70 sm:px-8 sm:pt-7">
        <div className="flex flex-col gap-2">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">Expense search</h2>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 lg:flex-row">
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
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          {(hasSearch || statusFilter !== "All") ? (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Clear view
            </button>
          ) : null}
        </div>

        {loadError ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            <div>Expense records could not be loaded from Supabase: {loadError}</div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-800 transition hover:bg-rose-100"
            >
              Refresh page
            </button>
          </div>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-[32px] bg-white shadow-xl ring-1 ring-slate-200/70">
        <div className="border-b border-slate-200 px-6 py-5 sm:px-8">
          <div className="flex items-center justify-between gap-3">
            <div className="text-lg font-semibold tracking-tight text-slate-900">Expenses</div>
            <div className="text-sm text-slate-500">
              {filteredExpenses.length} {filteredExpenses.length === 1 ? "expense" : "expenses"}
            </div>
          </div>
        </div>

        {filteredExpenses.length === 0 ? (
          <div className="px-6 py-16">
            <div className="mx-auto max-w-xl rounded-[28px] border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
              <div className="text-lg font-semibold text-slate-900">
                {hasNoExpenses ? "No expenses yet" : "No expenses match this view"}
              </div>
              {hasNoExpenses ? (
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Add the first expense record for this business to start tracking operational spend.
                </p>
              ) : null}
            </div>
          </div>
        ) : (
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
                  <th className="px-6 py-3.5 sm:px-8">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredExpenses.map((expense) => (
                  <ClickableTableRow
                    key={expense.id}
                    href={`/admin/expenses/${expense.id}`}
                    ariaLabel={`Open expense ${expense.vendor}`}
                    className="group cursor-pointer outline-none transition hover:bg-slate-50/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-300"
                  >
                    <td className="px-6 py-4 text-slate-600 transition group-hover:bg-slate-50/70 sm:px-8">
                      {formatDate(expense.expenseDate)}
                    </td>
                    <td className="px-4 py-4 text-slate-600 transition group-hover:bg-slate-50/70">{expense.category}</td>
                    <td className="px-4 py-4 transition group-hover:bg-slate-50/70">
                      <div className="font-semibold text-slate-900">{expense.vendor}</div>
                    </td>
                    <td className="px-4 py-4 font-semibold text-slate-900 transition group-hover:bg-slate-50/70">
                      {formatUsdFromCents(expense.amountCents)}
                    </td>
                    <td className="px-4 py-4 transition group-hover:bg-slate-50/70">
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
                    <td className="px-4 py-4 text-slate-600 transition group-hover:bg-slate-50/70">{expense.paymentMethod}</td>
                    <td className="px-6 py-4 transition group-hover:bg-slate-50/70 sm:px-8">
                      <div className="flex items-center justify-center">
                        <Link
                          href={`/admin/expenses/${expense.id}`}
                          aria-label={`Open expense ${expense.vendor}`}
                          className="inline-flex items-center justify-center rounded-full p-2 text-slate-400 transition group-hover:translate-x-0.5 group-hover:scale-110 group-hover:text-slate-700 group-focus-visible:translate-x-0.5 group-focus-visible:scale-110 group-focus-visible:text-slate-700 focus-visible:translate-x-0.5 focus-visible:scale-110 focus-visible:text-slate-700 focus-visible:outline-none"
                        >
                          <ChevronRightIcon className="h-6 w-6" />
                        </Link>
                      </div>
                    </td>
                  </ClickableTableRow>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
