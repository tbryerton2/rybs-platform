export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import {
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
} from "@heroicons/react/24/outline";
import {
  ANALYTICS_DATA_MODE,
  ANALYTICS_DATA_MODE_LABEL,
  AREA_OPTIONS,
  buildConversionAnalytics,
  DATE_RANGE_OPTIONS,
  DEVICE_OPTIONS,
  PRODUCT_OPTIONS,
  type AnalyticsFilters,
  type BreakdownRow,
  type DateRangeKey,
  type FunnelStep,
  type Insight,
  type KpiMetric,
  type TrendPoint,
  type UsageRow,
  VISITOR_OPTIONS,
} from "./mock-data";

type SearchParams = Record<string, string | string[] | undefined>;

function sp(obj: SearchParams, key: string) {
  const value = obj[key];
  return Array.isArray(value) ? value[0] : value;
}

function toFilters(searchParams: SearchParams): AnalyticsFilters {
  const range = sp(searchParams, "range");
  const device = sp(searchParams, "device");
  const area = sp(searchParams, "area");
  const product = sp(searchParams, "product");
  const visitorType = sp(searchParams, "visitorType");

  return {
    range:
      range === "7d" || range === "90d" || range === "6m" || range === "12m" || range === "all"
        ? range
        : "30d",
    device: device === "desktop" || device === "mobile" || device === "tablet" ? device : "all",
    area: area === "19124" || area === "19125" || area === "19134" || area === "19053" ? area : "all",
    product: product === "14-yard" || product === "20-yard" || product === "concrete" ? product : "all",
    visitorType: visitorType === "new" || visitorType === "returning" ? visitorType : "all",
  };
}

function buildFilterHref(filters: AnalyticsFilters, patch: Partial<AnalyticsFilters>) {
  const next = { ...filters, ...patch };
  const params = new URLSearchParams();

  params.set("range", next.range);
  if (next.device !== "all") params.set("device", next.device);
  if (next.area !== "all") params.set("area", next.area);
  if (next.product !== "all") params.set("product", next.product);
  if (next.visitorType !== "all") params.set("visitorType", next.visitorType);

  return `/admin/analytics/conversion?${params.toString()}`;
}

function percent(value: number, digits = 1) {
  return `${value.toFixed(digits)}%`;
}

function number(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function cardToneClasses(tone: KpiMetric["tone"]) {
  if (tone === "success") return "border-emerald-200/80 bg-emerald-50/70";
  if (tone === "warning") return "border-orange-200/80 bg-orange-50/80";
  return "border-slate-200/80 bg-white";
}

function insightToneClasses(tone: Insight["tone"]) {
  if (tone === "emerald") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (tone === "blue") return "bg-sky-50 text-sky-700 ring-sky-200";
  return "bg-orange-50 text-[#F97316] ring-orange-200";
}

function sectionCardClasses(extra = "") {
  return `rounded-[32px] border border-slate-200/80 bg-white shadow-sm ${extra}`;
}

function FilterBar({ filters }: { filters: AnalyticsFilters }) {
  return (
    <div className="space-y-4">
      <section className={sectionCardClasses("px-6 py-6")}>
        <div className="min-w-0">
          <div className="inline-flex items-center rounded-full bg-[#F97316]/10 px-3 py-1 text-xs font-semibold text-[#F97316]">
            Conversion & portal analytics
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
            Conversion & Portal Analytics
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            See where bookings stall, how conversion is trending, and whether the customer portal is reducing manual
            follow-up.
          </p>
          {ANALYTICS_DATA_MODE === "demo" ? (
            <div className="mt-4 inline-flex max-w-full items-center rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
              {ANALYTICS_DATA_MODE_LABEL}
            </div>
          ) : null}
        </div>
      </section>

      <section className={sectionCardClasses("px-6 py-5")}>
        <form
          className="grid gap-4 2xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] 2xl:items-end"
          action="/admin/analytics/conversion"
        >
          <input type="hidden" name="range" value={filters.range} />
          <div className="min-w-0 2xl:col-span-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Date range</div>
            <div className="flex flex-wrap items-center gap-2">
              {DATE_RANGE_OPTIONS.map((option) => {
                const active = option.value === filters.range;
                return (
                  <Link
                    key={option.value}
                    href={buildFilterHref(filters, { range: option.value as DateRangeKey })}
                    className={[
                      "inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold transition",
                      active
                        ? "bg-slate-900 text-white shadow-sm"
                        : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    {option.label}
                  </Link>
                );
              })}
            </div>
          </div>
          <FilterField label="Device type" name="device" value={filters.device} options={DEVICE_OPTIONS} />
          <FilterField label="Service area / ZIP" name="area" value={filters.area} options={AREA_OPTIONS} />
          <FilterField label="Dumpster type" name="product" value={filters.product} options={PRODUCT_OPTIONS} />
          <FilterField
            label="New vs returning"
            name="visitorType"
            value={filters.visitorType}
            options={VISITOR_OPTIONS}
          />
          <div className="flex min-w-0 items-end gap-3 md:justify-start 2xl:col-span-3 2xl:justify-end">
            <button
              type="submit"
              className="inline-flex h-11 min-w-[132px] items-center justify-center rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Apply filters
            </button>
            <Link
              href="/admin/analytics/conversion?range=30d"
              className="inline-flex h-11 min-w-[96px] items-center justify-center rounded-2xl border border-slate-200 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Reset
            </Link>
          </div>
        </form>
      </section>
    </div>
  );
}

function FilterField({
  label,
  name,
  value,
  options,
}: {
  label: string;
  name: string;
  value: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block min-w-0">
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <select
        name={name}
        defaultValue={value}
        className="h-11 w-full min-w-0 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 outline-none transition focus:border-slate-400"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{eyebrow}</div>
      <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ metric }: { metric: KpiMetric }) {
  const isPositive = metric.tone === "success";

  return (
    <div className={`rounded-[24px] border p-5 shadow-sm ${cardToneClasses(metric.tone)}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-500">{metric.label}</div>
          <div className="mt-2 text-[32px] font-semibold leading-none tracking-tight text-slate-900">
            {metric.value}
          </div>
        </div>
        <div
          className={[
            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset",
            isPositive
              ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
              : metric.tone === "warning"
                ? "bg-orange-50 text-[#F97316] ring-orange-200"
                : "bg-slate-100 text-slate-700 ring-slate-200",
          ].join(" ")}
        >
          {isPositive ? <ArrowTrendingUpIcon className="h-3.5 w-3.5" /> : <ArrowTrendingDownIcon className="h-3.5 w-3.5" />}
          {metric.change}
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600">{metric.helper}</p>
    </div>
  );
}

function FunnelStageCard({ step, maxSessions }: { step: FunnelStep; maxSessions: number }) {
  const width = maxSessions > 0 ? Math.max(14, Math.round((step.sessions / maxSessions) * 100)) : 0;

  return (
    <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">{step.label}</div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-slate-500">
            <span>{number(step.sessions)} sessions</span>
            <span>{percent(step.shareOfStarters)} of starters</span>
            {step.stepConversionRate !== null ? <span>{percent(step.stepConversionRate)} from prior step</span> : <span>Entry step</span>}
          </div>
        </div>
        <div className="flex w-full max-w-[290px] flex-col gap-2">
          <div className="h-3 overflow-hidden rounded-full bg-white ring-1 ring-slate-200">
            <div className="h-full rounded-full bg-[#F97316]" style={{ width: `${width}%` }} />
          </div>
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>{step.dropOffCount > 0 ? `${number(step.dropOffCount)} dropped` : "No drop-off yet"}</span>
            <span>{step.avgMinutesFromPrevious > 0 ? `${step.avgMinutesFromPrevious.toFixed(1)} min step time` : "Start"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function InsightPanel({ title, insights }: { title: string; insights: Insight[] }) {
  return (
    <section className={sectionCardClasses("p-6")}>
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-500">The main business signals to act on next.</p>

      <div className="mt-6 space-y-5">
        {insights.map((insight, index) => (
          <article key={insight.title} className={index === 0 ? "" : "border-t border-slate-200 pt-5"}>
            <div
              className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${insightToneClasses(
                insight.tone,
              )}`}
            >
              Standout
            </div>
            <h4 className="mt-3 text-base font-semibold text-slate-900">{insight.title}</h4>
            <p className="mt-2 text-sm leading-6 text-slate-600">{insight.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function LineChart({
  data,
  series,
  minValue,
  maxValue,
}: {
  data: TrendPoint[];
  series: Array<{ key: keyof TrendPoint; color: string }>;
  minValue?: number;
  maxValue?: number;
}) {
  const width = 600;
  const height = 220;
  const paddingX = 18;
  const paddingY = 18;

  const values = data.flatMap((point) => series.map((line) => Number(point[line.key])));
  const lower = minValue ?? Math.min(...values);
  const upper = maxValue ?? Math.max(...values);
  const span = Math.max(1, upper - lower);

  function pointX(index: number) {
    return paddingX + (index * (width - paddingX * 2)) / Math.max(1, data.length - 1);
  }

  function pointY(value: number) {
    return height - paddingY - ((value - lower) / span) * (height - paddingY * 2);
  }

  function toPath(key: keyof TrendPoint) {
    return data
      .map((point, index) => `${index === 0 ? "M" : "L"} ${pointX(index)} ${pointY(Number(point[key]))}`)
      .join(" ");
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full">
      {[0, 1, 2, 3].map((line) => {
        const y = paddingY + (line * (height - paddingY * 2)) / 3;
        return <line key={line} x1={paddingX} x2={width - paddingX} y1={y} y2={y} className="stroke-slate-200" strokeDasharray="4 6" />;
      })}

      {series.map((line) => (
        <path
          key={String(line.key)}
          d={toPath(line.key)}
          fill="none"
          stroke={line.color}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}

      {data.map((point, index) => (
        <g key={point.label}>
          {series.map((line) => (
            <circle
              key={`${point.label}-${String(line.key)}`}
              cx={pointX(index)}
              cy={pointY(Number(point[line.key]))}
              r="4.5"
              fill={line.color}
              className="stroke-white"
              strokeWidth="2"
            />
          ))}
        </g>
      ))}
    </svg>
  );
}

function ChartCard({
  title,
  subtitle,
  legend,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  legend?: Array<{ label: string; color: string }>;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <section className={sectionCardClasses("p-6")}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">{subtitle}</p>
        </div>
        {legend ? (
          <div className="flex flex-wrap gap-3">
            {legend.map((item) => (
              <div key={item.label} className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                {item.label}
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <div className="mt-6">{children}</div>
      {footer ? <div className="mt-5 border-t border-slate-200 pt-4 text-sm text-slate-500">{footer}</div> : null}
    </section>
  );
}

function ChartAxisLabels({ data }: { data: TrendPoint[] }) {
  return (
    <div className="mt-2 grid grid-cols-4 gap-2 text-xs font-medium text-slate-400 sm:grid-cols-8">
      {data.map((point) => (
        <div key={point.label} className="min-w-0 truncate">
          {point.label}
        </div>
      ))}
    </div>
  );
}

function DropOffChart({ data }: { data: TrendPoint[] }) {
  const maxValue = Math.max(
    ...data.map((point) => point.pricingDropOff + point.scheduleDropOff + point.contactDropOff + point.reviewDropOff),
  );

  return (
    <div className="space-y-4">
      {data.map((point) => {
        const total = point.pricingDropOff + point.scheduleDropOff + point.contactDropOff + point.reviewDropOff;
        return (
          <div key={point.label}>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium text-slate-700">{point.label}</span>
              <span className="text-slate-500">{number(total)} total drop-offs</span>
            </div>
            <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full bg-[#F97316]"
                style={{ width: `${(point.pricingDropOff / maxValue) * 100}%` }}
              />
              <div
                className="h-full bg-sky-500"
                style={{ width: `${(point.scheduleDropOff / maxValue) * 100}%` }}
              />
              <div
                className="h-full bg-emerald-500"
                style={{ width: `${(point.contactDropOff / maxValue) * 100}%` }}
              />
              <div
                className="h-full bg-slate-400"
                style={{ width: `${(point.reviewDropOff / maxValue) * 100}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function VerticalBarChart({
  data,
  getValue,
  color,
  formatValue,
}: {
  data: TrendPoint[];
  getValue: (point: TrendPoint) => number;
  color: string;
  formatValue: (value: number) => string;
}) {
  const maxValue = Math.max(...data.map(getValue));

  return (
    <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
      {data.map((point) => {
        const value = getValue(point);
        const height = maxValue > 0 ? Math.max(16, Math.round((value / maxValue) * 168)) : 16;
        return (
          <div key={point.label} className="min-w-0 flex flex-col items-center gap-3">
            <div className="text-xs font-semibold text-slate-500">{formatValue(value)}</div>
            <div className="flex h-44 items-end">
              <div className="w-9 rounded-t-2xl" style={{ height, backgroundColor: color }} />
            </div>
            <div className="max-w-full truncate text-xs font-medium text-slate-400">{point.label}</div>
          </div>
        );
      })}
    </div>
  );
}

function BreakdownTable({ title, rows }: { title: string; rows: BreakdownRow[] }) {
  const keySignal = [...rows].sort((a, b) => a.conversionRate - b.conversionRate)[0];

  return (
    <section className={sectionCardClasses("overflow-hidden")}>
      <div className="border-b border-slate-200 px-6 py-4">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              <th className="px-6 py-3">Segment</th>
              <th className="px-6 py-3">Started</th>
              <th className="px-6 py-3">Completed</th>
              <th className="px-6 py-3">Conversion</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.label}>
                <td className="px-6 py-4 font-semibold text-slate-900">{row.label}</td>
                <td className="px-6 py-4 text-slate-600">{number(row.started)}</td>
                <td className="px-6 py-4 text-slate-600">{number(row.completed)}</td>
                <td className="px-6 py-4">
                  <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                    {percent(row.conversionRate)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-slate-200 bg-slate-50/70 px-6 py-4 text-sm leading-6 text-slate-600">
        <span className="font-semibold text-slate-900">Signal:</span> {keySignal.note}
      </div>
    </section>
  );
}

function RankedUsageList({ title, rows }: { title: string; rows: UsageRow[] }) {
  const maxCount = Math.max(...rows.map((row) => row.count));

  return (
    <section className={sectionCardClasses("p-6")}>
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <div className="mt-6 space-y-1">
        {rows.map((row, index) => {
          const width = maxCount > 0 ? Math.max(16, Math.round((row.count / maxCount) * 100)) : 0;
          return (
            <div key={row.label} className={index === 0 ? "" : "border-t border-slate-200 pt-4"}>
              <div className="grid gap-3 lg:grid-cols-[44px_minmax(0,1fr)_auto] lg:items-start">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700">
                  {index + 1}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900">{row.label}</div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{row.detail}</p>
                </div>
                <div className="shrink-0 lg:text-right">
                  <div className="text-xl font-semibold tracking-tight text-slate-900">{number(row.count)}</div>
                  <div className="mt-1 text-xs font-medium text-slate-500">{row.share}% share</div>
                  <div className="mt-2 inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                    {row.trend}
                  </div>
                </div>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-slate-900" style={{ width: `${width}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ValuePanel({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; value: string; helper: string }>;
}) {
  return (
    <section className={sectionCardClasses("p-6")}>
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-slate-500">The directional measures most likely to reflect time saved and support deflection.</p>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-5">
            <div className="text-sm font-medium text-slate-500">{row.label}</div>
            <div className="mt-2 text-[30px] font-semibold leading-none tracking-tight text-slate-900">{row.value}</div>
            <p className="mt-3 text-sm leading-6 text-slate-600">{row.helper}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default async function ConversionAnalyticsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const filters = toFilters(resolvedSearchParams);
  const analytics = buildConversionAnalytics(filters);
  const maxFunnelSessions = Math.max(...analytics.funnel.map((step) => step.sessions));

  return (
    <main className="mx-auto min-w-0 max-w-[1080px] pb-16 pt-8">
      <FilterBar filters={filters} />

      <section className="mt-10 rounded-[36px] border border-slate-200/80 bg-white/80 p-6 shadow-sm lg:p-8">
        <SectionHeading
          eyebrow="Booking conversion"
          title="Where customers are falling out of the booking flow"
          description="This is the clearest view of booking health: how many people start, where they hesitate, and whether pricing or another step deserves attention first."
        />

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {analytics.bookingKpis.map((metric) => (
            <KpiCard key={metric.label} metric={metric} />
          ))}
        </section>

        <div className="mt-8 grid min-w-0 gap-6 2xl:grid-cols-[minmax(0,1.7fr)_300px]">
          <section className={sectionCardClasses("p-6")}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Booking funnel</h3>
                <p className="mt-1 text-sm leading-6 text-slate-500">The main path from start to booked order, with drop-off and step efficiency at each stage.</p>
              </div>
              <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                {analytics.funnel.length} stages
              </div>
            </div>
            <div className="mt-6 space-y-3.5">
              {analytics.funnel.map((step) => (
                <FunnelStageCard key={step.key} step={step} maxSessions={maxFunnelSessions} />
              ))}
            </div>
          </section>

          <InsightPanel title="What stands out" insights={analytics.bookingInsights} />
        </div>

        <div className="mt-8 space-y-6">
          <div className="grid min-w-0 gap-6 2xl:grid-cols-2">
            <ChartCard
              title="Conversion rate over time"
              subtitle="Use this to judge whether booking changes are improving close rate."
              footer="Conversion should improve before traffic growth matters."
            >
              <LineChart data={analytics.bookingTrends} series={[{ key: "conversionRate", color: "#0f172a" }]} minValue={20} maxValue={60} />
              <ChartAxisLabels data={analytics.bookingTrends} />
            </ChartCard>

            <ChartCard
              title="Sessions started vs completed"
              subtitle="Compares demand entering the flow with bookings actually closed."
              legend={[
                { label: "Started", color: "#F97316" },
                { label: "Completed", color: "#0f172a" },
              ]}
              footer="If started grows but completed stalls, the booking flow is leaking demand."
            >
              <LineChart
                data={analytics.bookingTrends}
                series={[
                  { key: "started", color: "#F97316" },
                  { key: "completed", color: "#0f172a" },
                ]}
              />
              <ChartAxisLabels data={analytics.bookingTrends} />
            </ChartCard>
          </div>

          <div className="grid min-w-0 gap-6 2xl:grid-cols-2">
            <ChartCard
              title="Drop-off by step over time"
              subtitle="Shows where abandonment is concentrating from period to period."
              legend={[
                { label: "Pricing", color: "#F97316" },
                { label: "Schedule/details", color: "#0ea5e9" },
                { label: "Contact", color: "#10b981" },
                { label: "Review", color: "#94a3b8" },
              ]}
              footer="Pricing should remain the first place to investigate unless another step overtakes it."
            >
              <DropOffChart data={analytics.bookingTrends} />
            </ChartCard>

            <ChartCard
              title="Average booking completion time"
              subtitle="Longer completion time usually means more hesitation or more interruption."
              footer="Use this with resume rate to tell the difference between healthy shopping and real friction."
            >
              <VerticalBarChart
                data={analytics.bookingTrends}
                getValue={(point) => point.avgCompletionMinutes}
                color="#0f172a"
                formatValue={(value) => `${value.toFixed(1)}m`}
              />
            </ChartCard>
          </div>
        </div>

        <div className="mt-8 grid min-w-0 gap-6 2xl:grid-cols-2">
          <BreakdownTable title="Conversion by device type" rows={analytics.breakdowns.devices} />
          <BreakdownTable title="Conversion by dumpster type" rows={analytics.breakdowns.products} />
          <BreakdownTable title="Conversion by ZIP / service area" rows={analytics.breakdowns.areas} />
          <BreakdownTable title="Conversion by day of week" rows={analytics.breakdowns.weekdays} />
        </div>
      </section>

      <section className="mt-14 rounded-[36px] border border-slate-200/80 bg-slate-50/70 p-6 shadow-sm lg:p-8">
        <SectionHeading
          eyebrow="Portal adoption & self-service"
          title="Whether the portal is creating real operational value"
          description="The portal matters if customers actually use it, come back to it, and complete actions that would otherwise become calls, texts, or manual office work."
        />

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {analytics.portalKpis.map((metric) => (
            <KpiCard key={metric.label} metric={metric} />
          ))}
        </section>

        <div className="mt-8 grid min-w-0 gap-6 2xl:grid-cols-2">
          <ChartCard
            title="Portal logins over time"
            subtitle="Shows whether the portal is becoming routine instead of one-time usage."
            footer="Login growth should translate into fewer simple status and pickup inquiries."
          >
            <LineChart data={analytics.bookingTrends} series={[{ key: "portalLogins", color: "#0f172a" }]} />
            <ChartAxisLabels data={analytics.bookingTrends} />
          </ChartCard>

          <ChartCard
            title="Unique portal users over time"
            subtitle="Tracks how many distinct customers are engaging, not just total sessions."
            footer="Adoption depends on unique users; stickiness depends on repeat sessions."
          >
            <VerticalBarChart
              data={analytics.bookingTrends}
              getValue={(point) => point.uniqueUsers}
              color="#F97316"
              formatValue={(value) => number(value)}
            />
          </ChartCard>
        </div>

        <div className="mt-8 grid gap-6 2xl:grid-cols-2">
          <RankedUsageList title="Most-used portal features" rows={analytics.portalFeatureUsage} />
          <RankedUsageList title="Most common self-service actions" rows={analytics.portalActionUsage} />
        </div>

        <div className="mt-8 grid min-w-0 gap-6 2xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          <InsightPanel title="What this means for the business" insights={analytics.portalInsights} />
          <ValuePanel title="Operational value summary" rows={analytics.portalValueStats} />
        </div>
      </section>
    </main>
  );
}
