export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { AdminPage, AdminPageHeader } from "@/app/admin/_components/admin/admin-page";
import { requireAdminOwner } from "@/lib/admin/auth";
import {
  buildReportsFilterHref,
  DATE_RANGE_OPTIONS,
  getAdminReportsData,
  parseReportsFilters,
  type BusinessTrendPoint,
  type DateRangeKey,
  type FilterOption,
  type KpiMetric,
  type ProductMixRow,
  type ReportsFilters,
} from "@/lib/admin/reports";
import {
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
} from "@heroicons/react/24/outline";

type SearchParams = Record<string, string | string[] | undefined>;

function percent(value: number, digits = 1) {
  return `${value.toFixed(digits)}%`;
}

function number(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function currency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function cardToneClasses(tone: KpiMetric["tone"]) {
  if (tone === "success") return "reports-card-success";
  if (tone === "warning") return "reports-card-warning";
  return "reports-card-neutral";
}

function trendToneClasses(tone: KpiMetric["tone"]) {
  if (tone === "success") return "reports-trend-success";
  if (tone === "warning") return "reports-trend-warning";
  return "reports-trend-neutral";
}

function sectionCardClasses(extra = "") {
  return `rounded-[20px] border border-slate-200/80 bg-white shadow-sm ${extra}`;
}

function FilterBar({
  filters,
  productOptions,
}: {
  filters: ReportsFilters;
  productOptions: FilterOption[];
}) {
  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Reports"
        description="See how your business is performing, from bookings to customer portal requests."
        className="mb-0"
      />

      <section className={sectionCardClasses("px-6 py-5")}>
        <form
          className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(260px,0.55fr)_auto] xl:items-end"
          action="/admin/analytics/conversion"
        >
          <input type="hidden" name="range" value={filters.range} />
          <input type="hidden" name="device" value={filters.device} />
          <input type="hidden" name="visitorType" value={filters.visitorType} />
          <div className="min-w-0">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Date range</div>
            <div className="flex flex-wrap items-center gap-2">
              {DATE_RANGE_OPTIONS.map((option) => {
                const active = option.value === filters.range;
                return (
                  <Link
                    key={option.value}
                    href={buildReportsFilterHref(filters, { range: option.value as DateRangeKey })}
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
          <FilterField label="Dumpster type" name="product" value={filters.product} options={productOptions} />
          <div className="flex min-w-0 items-end gap-3 md:justify-start xl:justify-end">
            <button
              type="submit"
              className="admin-btn admin-btn-primary h-11 min-w-[132px] px-5"
            >
              Apply filters
            </button>
            <Link
              href="/admin/analytics/conversion?range=30d"
              className="admin-btn admin-btn-secondary h-11 min-w-[96px] px-5"
            >
              Reset
            </Link>
          </div>
        </form>
      </section>
    </div>
  );
}

function FunnelFilterBar({
  filters,
  deviceOptions,
  visitorTypeOptions,
}: {
  filters: ReportsFilters;
  deviceOptions: FilterOption[];
  visitorTypeOptions: FilterOption[];
}) {
  return (
    <section className={sectionCardClasses("mt-6 px-6 py-5")}>
      <form
        className="grid gap-4 lg:grid-cols-[minmax(180px,0.45fr)_minmax(220px,0.45fr)_auto] lg:items-end"
        action="/admin/analytics/conversion"
      >
        <input type="hidden" name="range" value={filters.range} />
        <input type="hidden" name="product" value={filters.product} />
        <FilterField label="Device type" name="device" value={filters.device} options={deviceOptions} />
        <FilterField
          label="New vs returning"
          name="visitorType"
          value={filters.visitorType}
          options={visitorTypeOptions}
        />
        <div className="flex min-w-0 items-end gap-3 lg:justify-end">
          <button type="submit" className="admin-btn admin-btn-primary h-11 min-w-[132px] px-5">
            Apply filters
          </button>
          <Link
            href={buildReportsFilterHref(filters, { device: "all", visitorType: "all" })}
            className="admin-btn admin-btn-secondary h-11 min-w-[96px] px-5"
          >
            Reset
          </Link>
        </div>
      </form>
    </section>
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
        className="h-11 w-full min-w-0 rounded-[14px] border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 outline-none transition focus:border-slate-400"
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
  description?: string;
}) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{eyebrow}</div>
      <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h2>
          {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p> : null}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ metric }: { metric: KpiMetric }) {
  const isIncreasing = metric.change?.trim().startsWith("+") ?? false;
  const isDecreasing = metric.change?.trim().startsWith("-") ?? false;

  return (
    <div className={`rounded-[14px] border p-5 shadow-sm ${cardToneClasses(metric.tone)}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-500">{metric.label}</div>
          <div className="mt-2 text-[32px] font-semibold leading-none tracking-tight text-slate-900">
            {metric.value}
          </div>
        </div>
        {metric.change ? (
          <div
            className={[
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset",
              trendToneClasses(metric.tone),
            ].join(" ")}
          >
            {isIncreasing ? <ArrowTrendingUpIcon className="h-3.5 w-3.5" /> : null}
            {isDecreasing ? <ArrowTrendingDownIcon className="h-3.5 w-3.5" /> : null}
            {metric.change}
          </div>
        ) : null}
      </div>
      {metric.helper ? <p className="mt-3 text-sm leading-6 text-slate-600">{metric.helper}</p> : null}
      {metric.details?.length ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {metric.details.map((detail) => (
            <div key={detail.label} className="rounded-[10px] bg-white/75 px-3 py-2 ring-1 ring-inset ring-slate-200/80">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{detail.label}</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">{detail.value}</div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
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

function parseTrendBucketDate(point: BusinessTrendPoint) {
  if (!point.bucketStart) return null;

  const parsed = new Date(point.bucketStart);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatTrendTickLabel(point: BusinessTrendPoint, range: DateRangeKey) {
  const date = parseTrendBucketDate(point);
  if (!date) return point.label;

  if (range === "6m" || range === "12m") {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      month: "short",
    }).format(date);
  }

  if (range === "all") {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      month: "short",
      year: "2-digit",
    }).format(date);
  }

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  }).format(date);
}

function evenlySpacedIndexes(length: number, targetCount: number) {
  if (length <= 0 || targetCount <= 0) return [];
  if (length <= targetCount) return Array.from({ length }, (_, index) => index);

  const indexes = new Set<number>();
  const lastIndex = length - 1;

  for (let step = 0; step < targetCount; step += 1) {
    indexes.add(Math.round((step * lastIndex) / (targetCount - 1)));
  }

  indexes.add(0);
  indexes.add(lastIndex);

  return [...indexes].sort((a, b) => a - b);
}

function monthBoundaryIndexes(data: BusinessTrendPoint[], maxCount: number) {
  if (data.length === 0) return [];

  const indexes: number[] = [];
  let previousMonthKey: string | null = null;

  data.forEach((point, index) => {
    const date = parseTrendBucketDate(point);
    const monthKey = date ? `${date.getUTCFullYear()}-${date.getUTCMonth()}` : point.label;

    if (monthKey !== previousMonthKey) {
      indexes.push(index);
      previousMonthKey = monthKey;
    }
  });

  if (indexes.length <= maxCount) return indexes;

  return evenlySpacedIndexes(data.length, maxCount);
}

function trendTickIndexes(data: BusinessTrendPoint[], range: DateRangeKey) {
  if (range === "7d") return evenlySpacedIndexes(data.length, data.length);
  if (range === "30d" || range === "90d") return evenlySpacedIndexes(data.length, 7);
  if (range === "6m") return monthBoundaryIndexes(data, 7);
  if (range === "12m") return data.length <= 12 ? evenlySpacedIndexes(data.length, data.length) : evenlySpacedIndexes(data.length, 8);

  if (data.length <= 12) return evenlySpacedIndexes(data.length, data.length);
  return evenlySpacedIndexes(data.length, 8);
}

function BusinessAxisLabels({ data, range }: { data: BusinessTrendPoint[]; range: DateRangeKey }) {
  const tickIndexes = trendTickIndexes(data, range);

  return (
    <div
      className="mt-2 grid gap-2 text-xs font-medium text-slate-400"
      style={{ gridTemplateColumns: `repeat(${Math.max(1, tickIndexes.length)}, minmax(0, 1fr))` }}
    >
      {tickIndexes.map((index) => {
        const point = data[index];

        if (!point) return null;

        return (
          <div key={`${point.bucketStart ?? point.label}-${index}`} className="min-w-0 truncate whitespace-nowrap">
            {formatTrendTickLabel(point, range)}
          </div>
        );
      })}
    </div>
  );
}

function BusinessLineChartMarkers({
  data,
  range,
  series,
  pointX,
  pointY,
}: {
  data: BusinessTrendPoint[];
  range: DateRangeKey;
  series: Array<{ key: keyof BusinessTrendPoint; color: string }>;
  pointX: (index: number) => number;
  pointY: (key: keyof BusinessTrendPoint, value: number) => number;
}) {
  if (range !== "7d" && data.length > 1) return null;

  return (
    <>
      {data.map((point, index) => (
        <g key={point.bucketStart ?? point.label}>
          {series.map((line) => (
            <circle
              key={`${point.bucketStart ?? point.label}-${String(line.key)}`}
              cx={pointX(index)}
              cy={pointY(line.key, Number(point[line.key]))}
              r="4.5"
              fill={line.color}
              className="stroke-white"
              strokeWidth="2"
            />
          ))}
        </g>
      ))}
    </>
  );
}

function BusinessLineChart({
  data,
  range,
  series,
}: {
  data: BusinessTrendPoint[];
  range: DateRangeKey;
  series: Array<{ key: keyof BusinessTrendPoint; color: string }>;
}) {
  const width = 600;
  const height = 220;
  const paddingX = 18;
  const paddingY = 18;

  function pointX(index: number) {
    return paddingX + (index * (width - paddingX * 2)) / Math.max(1, data.length - 1);
  }

  function toPath(key: keyof BusinessTrendPoint) {
    const values = data.map((point) => Number(point[key]));
    const lower = Math.min(...values);
    const upper = Math.max(...values);
    const span = Math.max(1, upper - lower);

    return data
      .map((point, index) => {
        const y = height - paddingY - ((Number(point[key]) - lower) / span) * (height - paddingY * 2);
        return `${index === 0 ? "M" : "L"} ${pointX(index)} ${y}`;
      })
      .join(" ");
  }

  function pointY(key: keyof BusinessTrendPoint, value: number) {
    const values = data.map((point) => Number(point[key]));
    const lower = Math.min(...values);
    const upper = Math.max(...values);
    const span = Math.max(1, upper - lower);
    return height - paddingY - ((value - lower) / span) * (height - paddingY * 2);
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

      <BusinessLineChartMarkers data={data} range={range} series={series} pointX={pointX} pointY={pointY} />
    </svg>
  );
}

function ProductMixTable({ rows }: { rows: ProductMixRow[] }) {
  return (
    <section className={sectionCardClasses("overflow-hidden")}>
      <div className="border-b border-slate-200 px-6 py-4">
        <h3 className="text-lg font-semibold text-slate-900">Revenue and booking mix by dumpster type</h3>
      </div>
      <div className="overflow-x-auto">
        {rows.length > 0 ? (
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                <th className="px-6 py-3">Dumpster type</th>
                <th className="px-6 py-3">Revenue</th>
                <th className="px-6 py-3">Bookings</th>
                <th className="px-6 py-3">Avg order</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.label}>
                  <td className="px-6 py-4 font-semibold text-slate-900">{row.label}</td>
                  <td className="px-6 py-4 text-slate-600">
                    {currency(row.revenue)}
                    <div className="mt-1 text-xs text-slate-400">{percent(row.revenueShare, 0)} of revenue</div>
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    {number(row.bookings)}
                    <div className="mt-1 text-xs text-slate-400">{percent(row.bookingShare, 0)} of bookings</div>
                  </td>
                  <td className="px-6 py-4 text-slate-600">{currency(row.avgOrderValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="px-6 py-10 text-sm text-slate-500">No booking data for this period.</div>
        )}
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
  const filters = parseReportsFilters(resolvedSearchParams);
  const adminSession = await requireAdminOwner();
  const reports = await getAdminReportsData({
    businessId: adminSession.business.id,
    filters,
  });

  return (
    <AdminPage className="min-w-0 pt-8">
      <FilterBar filters={reports.filters} productOptions={reports.productOptions} />

      <section className="mt-10 rounded-[20px] border border-slate-200/80 bg-white p-6 shadow-sm lg:p-8">
        <SectionHeading
          eyebrow="Business performance"
          title="How the business is performing"
          description="Booked rental value, booking volume, dumpster mix, and repeat business signals for the selected period."
        />

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {reports.businessKpis.map((metric) => (
            <KpiCard key={metric.label} metric={metric} />
          ))}
        </section>

        <div className="mt-8 grid min-w-0 gap-6 2xl:grid-cols-2">
          <ChartCard
            title="Revenue trend over time"
            subtitle="Booked rental revenue across the selected period."
            legend={[{ label: "Revenue", color: "#0f172a" }]}
            footer={`Accepted bookings created during the selected ${reports.dateRangeLabel} range.`}
          >
            <BusinessLineChart
              data={reports.businessTrends}
              range={reports.filters.range}
              series={[{ key: "revenue", color: "#0f172a" }]}
            />
            <BusinessAxisLabels data={reports.businessTrends} range={reports.filters.range} />
          </ChartCard>

          <ChartCard
            title="Booking volume trend over time"
            subtitle="Accepted bookings created during the selected period."
            legend={[{ label: "Bookings", color: "#F97316" }]}
            footer="Use this with revenue to spot whether growth is volume-led or value-led."
          >
            <BusinessLineChart
              data={reports.businessTrends}
              range={reports.filters.range}
              series={[{ key: "bookings", color: "#F97316" }]}
            />
            <BusinessAxisLabels data={reports.businessTrends} range={reports.filters.range} />
          </ChartCard>
        </div>

        <div className="mt-8">
          <ProductMixTable rows={reports.productMix} />
        </div>
      </section>

      <section className="mt-14 rounded-[20px] border border-slate-200/80 bg-white p-6 shadow-sm lg:p-8">
        <SectionHeading
          eyebrow="Website funnel health"
          title="How website visitors move through booking"
          description="See where customers enter, complete, or leave the online booking process"
        />

        <FunnelFilterBar
          filters={reports.filters}
          deviceOptions={reports.deviceOptions}
          visitorTypeOptions={reports.visitorTypeOptions}
        />

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {reports.websiteFunnelKpis.map((metric) => (
            <KpiCard key={metric.label} metric={metric} />
          ))}
        </section>

        {!reports.websiteFunnelHasData ? (
          <div className="mt-6 rounded-[14px] border border-slate-200 bg-slate-50 px-5 py-4 text-sm leading-6 text-slate-600">
            No tracked website funnel sessions match the selected filters for this period.
          </div>
        ) : null}
      </section>

      <section className="mt-14 rounded-[20px] border border-slate-200/80 bg-slate-50/70 p-6 shadow-sm lg:p-8">
        <SectionHeading
          eyebrow="Customer portal value"
          title="How customers are using portal workflows"
        />

        <section className="mt-6 grid gap-4 md:grid-cols-2">
          {reports.portalKpis.map((metric) => (
            <KpiCard key={metric.label} metric={metric} />
          ))}
        </section>
      </section>
    </AdminPage>
  );
}
