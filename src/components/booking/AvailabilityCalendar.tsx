"use client";

import { useEffect, useMemo, useState } from "react";

export type CalendarAvailabilityState = "available" | "limited" | "unavailable" | "past";

export type CalendarAvailabilityEntry = {
  date: string;
  remaining: number;
  capacity: number;
  used: number;
  state: CalendarAvailabilityState;
  label?: string;
};

type CalendarLegendItem = {
  label: string;
  dotClassName: string;
};

type AvailabilityCalendarProps = {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  entries: CalendarAvailabilityEntry[];
  loading?: boolean;
  loadError?: string | null;
  nextAvailableDate?: string | null;
  getTileLabel?: (entry: CalendarAvailabilityEntry | undefined, context: { isCurrentMonth: boolean }) => string | null;
  legendItems?: CalendarLegendItem[];
  loadingMessage?: string;
  emptyMonthMessage?: (monthLabel: string, nextAvailableDate?: string | null) => string;
  getAriaLabel?: (entry: CalendarAvailabilityEntry | undefined, date: string) => string;
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function todayYmdLocal() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseYmd(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toYmd(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function getMonthGrid(month: Date) {
  const first = startOfMonth(month);
  const start = addDays(first, -first.getDay());
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

function formatMonthLabel(date: Date) {
  return `${MONTH_LABELS[date.getMonth()]} ${date.getFullYear()}`;
}

function formatDateLong(ymd: string) {
  const date = parseYmd(ymd);
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function getStatusLabel(entry: CalendarAvailabilityEntry | undefined) {
  if (!entry) return "Not loaded";
  if (entry.state === "past") return "Past";
  if (entry.state === "limited") return "Limited";
  if (entry.state === "available") return "Available";
  return "Unavailable";
}

export function AvailabilityCalendar({
  selectedDate,
  onSelectDate,
  entries,
  loading = false,
  loadError,
  nextAvailableDate,
  getTileLabel,
  legendItems,
  loadingMessage = "Loading calendar availability…",
  emptyMonthMessage,
  getAriaLabel,
}: AvailabilityCalendarProps) {
  const today = todayYmdLocal();
  const availabilityByDate = useMemo(
    () => new Map(entries.map((entry) => [entry.date, entry])),
    [entries],
  );

  const initialMonth = useMemo(() => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
      return startOfMonth(parseYmd(selectedDate));
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(nextAvailableDate || "")) {
      return startOfMonth(parseYmd(String(nextAvailableDate)));
    }
    return startOfMonth(parseYmd(today));
  }, [nextAvailableDate, selectedDate, today]);

  const [visibleMonth, setVisibleMonth] = useState(initialMonth);

  useEffect(() => {
    setVisibleMonth(initialMonth);
  }, [initialMonth]);

  const monthDates = useMemo(() => getMonthGrid(visibleMonth), [visibleMonth]);
  const visibleMonthKey = `${visibleMonth.getFullYear()}-${String(visibleMonth.getMonth() + 1).padStart(2, "0")}`;
  const minLoadedMonth = useMemo(
    () => (entries[0] ? startOfMonth(parseYmd(entries[0].date)) : null),
    [entries],
  );
  const maxLoadedMonth = useMemo(
    () => (entries[entries.length - 1] ? startOfMonth(parseYmd(entries[entries.length - 1].date)) : null),
    [entries],
  );

  const monthEntries = useMemo(
    () => monthDates
      .map((date) => availabilityByDate.get(toYmd(date)))
      .filter((entry): entry is CalendarAvailabilityEntry => Boolean(entry))
      .filter((entry) => entry.date.startsWith(visibleMonthKey)),
    [availabilityByDate, monthDates, visibleMonthKey],
  );

  const monthHasLoadedDates = monthEntries.length > 0;
  const monthHasAvailable = monthEntries.some(
    (entry) => entry.state === "available" || entry.state === "limited",
  );

  const resolvedLegendItems = legendItems ?? [
    { label: "Available", dotClassName: "bg-emerald-500" },
    { label: "Limited", dotClassName: "bg-amber-500" },
    { label: "Unavailable", dotClassName: "bg-slate-400" },
  ];

  return (
    <div className="rounded-[28px] border border-slate-200/80 bg-white/95 p-4 shadow-[0_24px_70px_-36px_rgba(15,23,42,0.45)] sm:p-4">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">
            {formatMonthLabel(visibleMonth)}
          </h2>
        </div>
        <div className="flex items-center gap-1 self-start rounded-full border border-slate-200/90 bg-slate-50/90 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
          <button
            type="button"
            onClick={() => setVisibleMonth((month) => addMonths(month, -1))}
            disabled={Boolean(minLoadedMonth && addMonths(visibleMonth, -1) < minLoadedMonth)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-sm text-slate-700 transition hover:bg-white hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-[#F97316]/40 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
            aria-label="Previous month"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => setVisibleMonth((month) => addMonths(month, 1))}
            disabled={Boolean(maxLoadedMonth && addMonths(visibleMonth, 1) > maxLoadedMonth)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-sm text-slate-700 transition hover:bg-white hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-[#F97316]/40 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
            aria-label="Next month"
          >
            →
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 sm:gap-1.5 sm:text-[11px]">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="py-1.5">
            {label}
          </div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1 sm:gap-1.5">
        {monthDates.map((date) => {
          const ymd = toYmd(date);
          const entry = availabilityByDate.get(ymd);
          const isCurrentMonth = date.getMonth() === visibleMonth.getMonth();
          const isSelected = ymd === selectedDate;
          const isToday = ymd === today;
          const isDisabled =
            !isCurrentMonth ||
            !entry ||
            entry.state === "past" ||
            entry.state === "unavailable";

          const baseClassName =
            "group relative min-h-[56px] rounded-[16px] border px-2 py-2 text-left transition focus:outline-none focus:ring-2 focus:ring-[#F97316]/40 sm:min-h-[74px] sm:px-2.5 sm:py-2.5";

          let stateClassName =
            "border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50";

          if (!isCurrentMonth) {
            stateClassName = "border-transparent bg-slate-50/20 text-slate-300";
          } else if (!entry || entry.state === "past") {
            stateClassName = "border-slate-200/70 bg-slate-100/70 text-slate-400";
          } else if (entry.state === "unavailable") {
            stateClassName = "border-slate-200 bg-slate-100/95 text-slate-400";
          } else if (entry.state === "limited") {
            stateClassName =
              "border-amber-300 bg-amber-50/95 text-amber-950 ring-1 ring-amber-200/60 hover:border-amber-400 hover:bg-amber-100/85";
          } else {
            stateClassName =
              "border-emerald-200 bg-emerald-50/90 text-emerald-950 hover:border-emerald-300 hover:bg-emerald-100/80";
          }

          if (isSelected) {
            stateClassName =
              "border-[#F97316] bg-[#F97316] text-white shadow-[0_16px_30px_-18px_rgba(249,115,22,0.85)]";
          }

          return (
            <button
              key={ymd}
              type="button"
              disabled={isDisabled}
              onClick={() => onSelectDate(ymd)}
              aria-pressed={isSelected}
              aria-label={getAriaLabel ? getAriaLabel(entry, ymd) : `${formatDateLong(ymd)}. ${getStatusLabel(entry)}.`}
              className={`${baseClassName} ${stateClassName} ${isDisabled ? "cursor-not-allowed" : "cursor-pointer"}`}
              title={
                !entry
                  ? "Availability not loaded"
                  : entry.state === "unavailable"
                    ? `${formatDateLong(ymd)} is unavailable`
                    : entry.state === "past"
                      ? `${formatDateLong(ymd)} is no longer bookable`
                      : `${formatDateLong(ymd)} has ${entry.remaining} dumpster${entry.remaining === 1 ? "" : "s"} available`
              }
            >
              <div className="flex items-start justify-between gap-1">
                <span
                  className={`text-base font-semibold sm:text-lg ${!isCurrentMonth ? "opacity-55" : ""} ${isSelected ? "text-white" : ""}`}
                >
                  {date.getDate()}
                </span>
                {isToday && (
                  <span
                    className={`inline-flex h-2.5 w-2.5 rounded-full ring-2 ${
                      isSelected ? "bg-white ring-white/35" : "bg-[#F97316] ring-[#F97316]/20"
                    }`}
                    aria-hidden="true"
                  />
                )}
              </div>

              <div className="mt-1.5 flex min-h-[14px] items-end">
                {(() => {
                  const label = getTileLabel
                    ? getTileLabel(entry, { isCurrentMonth })
                    : !isCurrentMonth
                      ? null
                      : !entry || entry.state === "past"
                        ? "Past"
                        : entry.state === "unavailable"
                          ? "Sold out"
                          : `${entry.remaining} left`;

                  return label ? (
                    <span
                      className={`text-[10px] font-medium ${
                        !entry || entry.state === "unavailable" || entry.state === "past"
                          ? isSelected
                            ? "text-white/85"
                            : "text-slate-500"
                          : isSelected
                            ? "text-white/85"
                            : "text-current/80"
                      }`}
                    >
                      {label}
                    </span>
                  ) : null;
                })()}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex flex-col gap-2 border-t border-slate-200/80 pt-2">
        <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
          {resolvedLegendItems.map((item) => (
            <div key={item.label} className="inline-flex items-center gap-2 rounded-full bg-slate-100/70 px-2.5 py-1">
              <span className={`inline-flex h-2.5 w-2.5 rounded-full ${item.dotClassName}`} aria-hidden="true" />
              {item.label}
            </div>
          ))}
        </div>

        {loadError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            {loadError}
          </div>
        ) : loading ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {loadingMessage}
          </div>
        ) : !monthHasLoadedDates ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            More dates are not loaded for this month yet.
          </div>
        ) : !monthHasAvailable ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            {emptyMonthMessage
              ? emptyMonthMessage(formatMonthLabel(visibleMonth), nextAvailableDate)
              : `No delivery dates available in ${formatMonthLabel(visibleMonth)}.${nextAvailableDate ? ` Next available: ${formatDateLong(nextAvailableDate)}.` : ""}`}
          </div>
        ) : null}
      </div>
    </div>
  );
}
