export type DateRangeKey = "7d" | "30d" | "90d" | "6m" | "12m" | "all";
export type DeviceFilter = "all" | "desktop" | "mobile" | "tablet";
export type AreaFilter = "all" | "19124" | "19125" | "19134" | "19053";
export type ProductFilter = "all" | "14-yard" | "20-yard" | "concrete";
export type VisitorFilter = "all" | "new" | "returning";

export type AnalyticsFilters = {
  range: DateRangeKey;
  device: DeviceFilter;
  area: AreaFilter;
  product: ProductFilter;
  visitorType: VisitorFilter;
};

export type FunnelStep = {
  key: string;
  label: string;
  sessions: number;
  shareOfStarters: number;
  dropOffCount: number;
  stepConversionRate: number | null;
  avgMinutesFromPrevious: number;
};

export type TrendPoint = {
  label: string;
  started: number;
  completed: number;
  conversionRate: number;
  avgCompletionMinutes: number;
  pricingDropOff: number;
  scheduleDropOff: number;
  contactDropOff: number;
  reviewDropOff: number;
  portalLogins: number;
  uniqueUsers: number;
};

export type KpiMetric = {
  label: string;
  value: string;
  change: string;
  tone?: "default" | "success" | "warning";
  helper: string;
};

export type Insight = {
  title: string;
  body: string;
  tone: "orange" | "blue" | "emerald";
};

export type BreakdownRow = {
  label: string;
  started: number;
  completed: number;
  conversionRate: number;
  note: string;
};

export type UsageRow = {
  label: string;
  count: number;
  share: number;
  trend: string;
  detail: string;
};

export type ValueStat = {
  label: string;
  value: string;
  helper: string;
};

export type ConversionAnalyticsData = {
  filters: AnalyticsFilters;
  bookingKpis: KpiMetric[];
  funnel: FunnelStep[];
  bookingInsights: Insight[];
  bookingTrends: TrendPoint[];
  breakdowns: {
    devices: BreakdownRow[];
    products: BreakdownRow[];
    areas: BreakdownRow[];
    weekdays: BreakdownRow[];
  };
  portalKpis: KpiMetric[];
  portalInsights: Insight[];
  portalFeatureUsage: UsageRow[];
  portalActionUsage: UsageRow[];
  portalValueStats: ValueStat[];
};

export const ANALYTICS_DATA_MODE = "demo";
export const ANALYTICS_DATA_MODE_LABEL =
  "Preview mode: showing sample analytics until live tracking is connected.";

export const DATE_RANGE_OPTIONS: Array<{ value: DateRangeKey; label: string }> = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
  { value: "6m", label: "6M" },
  { value: "12m", label: "12M" },
  { value: "all", label: "All time" },
];

export const DEVICE_OPTIONS: Array<{ value: DeviceFilter; label: string }> = [
  { value: "all", label: "All devices" },
  { value: "desktop", label: "Desktop" },
  { value: "mobile", label: "Mobile" },
  { value: "tablet", label: "Tablet" },
];

export const AREA_OPTIONS: Array<{ value: AreaFilter; label: string }> = [
  { value: "all", label: "All service areas" },
  { value: "19124", label: "19124" },
  { value: "19125", label: "19125" },
  { value: "19134", label: "19134" },
  { value: "19053", label: "19053" },
];

export const PRODUCT_OPTIONS: Array<{ value: ProductFilter; label: string }> = [
  { value: "all", label: "All dumpster types" },
  { value: "14-yard", label: "14-yard dumpster" },
  { value: "20-yard", label: "20-yard dumpster" },
  { value: "concrete", label: "Concrete / heavy debris" },
];

export const VISITOR_OPTIONS: Array<{ value: VisitorFilter; label: string }> = [
  { value: "all", label: "All visitors" },
  { value: "new", label: "New visitors" },
  { value: "returning", label: "Returning visitors" },
];

type RawTrendPoint = {
  started: number;
  completed: number;
  avgCompletionMinutes: number;
  portalLogins: number;
  uniqueUsers: number;
};

const mockConversionSeriesBase: RawTrendPoint[] = [
  { started: 118, completed: 44, avgCompletionMinutes: 19.2, portalLogins: 92, uniqueUsers: 58 },
  { started: 126, completed: 49, avgCompletionMinutes: 18.6, portalLogins: 98, uniqueUsers: 61 },
  { started: 132, completed: 53, avgCompletionMinutes: 18.1, portalLogins: 103, uniqueUsers: 63 },
  { started: 139, completed: 55, avgCompletionMinutes: 17.9, portalLogins: 108, uniqueUsers: 66 },
  { started: 148, completed: 61, avgCompletionMinutes: 17.4, portalLogins: 115, uniqueUsers: 69 },
  { started: 154, completed: 65, avgCompletionMinutes: 17.1, portalLogins: 118, uniqueUsers: 70 },
  { started: 161, completed: 70, avgCompletionMinutes: 16.8, portalLogins: 124, uniqueUsers: 74 },
  { started: 168, completed: 72, avgCompletionMinutes: 16.5, portalLogins: 128, uniqueUsers: 77 },
  { started: 176, completed: 77, avgCompletionMinutes: 16.1, portalLogins: 134, uniqueUsers: 81 },
  { started: 182, completed: 81, avgCompletionMinutes: 15.8, portalLogins: 139, uniqueUsers: 84 },
  { started: 189, completed: 86, avgCompletionMinutes: 15.6, portalLogins: 144, uniqueUsers: 88 },
  { started: 194, completed: 91, avgCompletionMinutes: 15.3, portalLogins: 151, uniqueUsers: 92 },
];

function number(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function percent(value: number, digits = 1) {
  return `${value.toFixed(digits)}%`;
}

function formatMinutes(value: number) {
  return `${value.toFixed(1)} min`;
}

function rangePointCount(range: DateRangeKey) {
  if (range === "7d") return 7;
  if (range === "30d") return 8;
  if (range === "90d") return 12;
  if (range === "6m") return 12;
  if (range === "12m") return 12;
  return 12;
}

function getMultipliers(filters: AnalyticsFilters) {
  let starterMultiplier = 1;
  let completionMultiplier = 1;
  let portalMultiplier = 1;
  let timeOffset = 0;

  if (filters.device === "mobile") {
    starterMultiplier *= 1.08;
    completionMultiplier *= 0.88;
    portalMultiplier *= 0.9;
    timeOffset += 1.5;
  }
  if (filters.device === "desktop") {
    starterMultiplier *= 0.74;
    completionMultiplier *= 0.95;
    portalMultiplier *= 1.05;
    timeOffset -= 0.4;
  }
  if (filters.device === "tablet") {
    starterMultiplier *= 0.22;
    completionMultiplier *= 0.93;
    portalMultiplier *= 0.35;
    timeOffset += 0.8;
  }

  if (filters.area === "19124") {
    starterMultiplier *= 0.34;
    completionMultiplier *= 0.92;
    portalMultiplier *= 0.38;
    timeOffset += 0.3;
  }
  if (filters.area === "19125") {
    starterMultiplier *= 0.26;
    completionMultiplier *= 1.03;
    portalMultiplier *= 0.33;
    timeOffset -= 0.2;
  }
  if (filters.area === "19134") {
    starterMultiplier *= 0.24;
    completionMultiplier *= 0.96;
    portalMultiplier *= 0.28;
    timeOffset += 0.1;
  }
  if (filters.area === "19053") {
    starterMultiplier *= 0.18;
    completionMultiplier *= 1.05;
    portalMultiplier *= 0.22;
    timeOffset -= 0.3;
  }

  if (filters.product === "14-yard") {
    starterMultiplier *= 0.54;
    completionMultiplier *= 1.02;
    portalMultiplier *= 0.51;
    timeOffset -= 0.2;
  }
  if (filters.product === "20-yard") {
    starterMultiplier *= 0.31;
    completionMultiplier *= 0.97;
    portalMultiplier *= 0.29;
    timeOffset += 0.2;
  }
  if (filters.product === "concrete") {
    starterMultiplier *= 0.15;
    completionMultiplier *= 0.84;
    portalMultiplier *= 0.14;
    timeOffset += 2.1;
  }

  if (filters.visitorType === "new") {
    starterMultiplier *= 0.72;
    completionMultiplier *= 0.86;
    portalMultiplier *= 0.62;
    timeOffset += 1.4;
  }
  if (filters.visitorType === "returning") {
    starterMultiplier *= 0.28;
    completionMultiplier *= 1.14;
    portalMultiplier *= 0.58;
    timeOffset -= 1.1;
  }

  return { starterMultiplier, completionMultiplier, portalMultiplier, timeOffset };
}

function buildLabels(pointCount: number) {
  const labels: string[] = [];
  const today = new Date("2026-03-22T12:00:00-04:00");

  for (let index = pointCount - 1; index >= 0; index -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - index * 4);
    labels.push(
      new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "America/New_York",
      }).format(date),
    );
  }

  return labels;
}

function buildTrendPoints(filters: AnalyticsFilters) {
  const pointCount = rangePointCount(filters.range);
  const basePoints = mockConversionSeriesBase.slice(-pointCount);
  const labels = buildLabels(pointCount);
  const { starterMultiplier, completionMultiplier, portalMultiplier, timeOffset } =
    getMultipliers(filters);

  return basePoints.map((point, index) => {
    const started = Math.max(8, Math.round(point.started * starterMultiplier));
    const completed = Math.min(
      started - 1,
      Math.max(2, Math.round(point.completed * starterMultiplier * completionMultiplier)),
    );
    const conversionRate = (completed / started) * 100;
    const pricingDropOff = Math.max(2, Math.round(started * (0.22 + (filters.device === "mobile" ? 0.05 : 0))));
    const scheduleDropOff = Math.max(1, Math.round(started * (0.1 + (filters.product === "concrete" ? 0.04 : 0))));
    const contactDropOff = Math.max(1, Math.round(started * 0.06));
    const reviewDropOff = Math.max(1, Math.round(started * (0.03 + (filters.visitorType === "new" ? 0.02 : 0))));

    return {
      label: labels[index],
      started,
      completed,
      conversionRate,
      avgCompletionMinutes: Math.max(8.6, point.avgCompletionMinutes + timeOffset),
      pricingDropOff,
      scheduleDropOff,
      contactDropOff,
      reviewDropOff,
      portalLogins: Math.max(4, Math.round(point.portalLogins * portalMultiplier)),
      uniqueUsers: Math.max(3, Math.round(point.uniqueUsers * portalMultiplier)),
    };
  });
}

function buildMockBookingFunnelData(starters: number, filters: AnalyticsFilters) {
  const pricingRate = 0.78 - (filters.device === "mobile" ? 0.06 : 0) - (filters.product === "concrete" ? 0.04 : 0);
  const scheduleRate = 0.83 - (filters.product === "concrete" ? 0.06 : 0) + (filters.visitorType === "returning" ? 0.03 : 0);
  const contactRate = 0.9 - (filters.visitorType === "new" ? 0.03 : 0);
  const reviewRate = 0.94;
  const completeRate = 0.79 + (filters.visitorType === "returning" ? 0.06 : 0) - (filters.device === "mobile" ? 0.03 : 0);

  const stages = [
    { key: "started", label: "Started booking", rate: 1, minutes: 0 },
    { key: "pricing", label: "Reached pricing", rate: pricingRate, minutes: 2.2 },
    { key: "schedule", label: "Reached schedule/details", rate: scheduleRate, minutes: 4.3 },
    { key: "contact", label: "Reached contact info", rate: contactRate, minutes: 3.1 },
    { key: "review", label: "Reached review", rate: reviewRate, minutes: 2.4 },
    { key: "complete", label: "Completed booking", rate: completeRate, minutes: 3.6 },
  ];

  const rows: FunnelStep[] = [];
  let previousSessions = starters;

  stages.forEach((stage, index) => {
    const sessions = index === 0 ? starters : Math.round(previousSessions * stage.rate);

    rows.push({
      key: stage.key,
      label: stage.label,
      sessions,
      shareOfStarters: (sessions / starters) * 100,
      dropOffCount: index === 0 ? 0 : Math.max(0, previousSessions - sessions),
      stepConversionRate: index === 0 ? null : (sessions / previousSessions) * 100,
      avgMinutesFromPrevious: stage.minutes,
    });

    previousSessions = sessions;
  });

  return rows;
}

function buildMockBreakdownData(totalStarted: number, totalCompleted: number) {
  return {
    devices: [
      {
        label: "Desktop",
        started: Math.round(totalStarted * 0.34),
        completed: Math.round(totalCompleted * 0.41),
        conversionRate: 46.8,
        note: "Best finish rate once customers see pricing.",
      },
      {
        label: "Mobile",
        started: Math.round(totalStarted * 0.56),
        completed: Math.round(totalCompleted * 0.45),
        conversionRate: 29.9,
        note: "Largest pricing-step abandonment and longest completion time.",
      },
      {
        label: "Tablet",
        started: Math.round(totalStarted * 0.1),
        completed: Math.round(totalCompleted * 0.14),
        conversionRate: 39.8,
        note: "Small volume but healthy review completion.",
      },
    ],
    products: [
      {
        label: "14-yard dumpster",
        started: Math.round(totalStarted * 0.52),
        completed: Math.round(totalCompleted * 0.57),
        conversionRate: 42.3,
        note: "Best converting core rental.",
      },
      {
        label: "20-yard dumpster",
        started: Math.round(totalStarted * 0.31),
        completed: Math.round(totalCompleted * 0.29),
        conversionRate: 35.5,
        note: "More hesitation during pricing and schedule review.",
      },
      {
        label: "Concrete / heavy debris",
        started: Math.round(totalStarted * 0.17),
        completed: Math.round(totalCompleted * 0.14),
        conversionRate: 28.1,
        note: "Heavier friction around price sensitivity and material rules.",
      },
    ],
    areas: [
      {
        label: "19124",
        started: Math.round(totalStarted * 0.28),
        completed: Math.round(totalCompleted * 0.25),
        conversionRate: 33.8,
        note: "Below-average finish rate after pricing.",
      },
      {
        label: "19125",
        started: Math.round(totalStarted * 0.22),
        completed: Math.round(totalCompleted * 0.26),
        conversionRate: 42.9,
        note: "Strongest conversion among top-volume ZIPs.",
      },
      {
        label: "19134",
        started: Math.round(totalStarted * 0.19),
        completed: Math.round(totalCompleted * 0.18),
        conversionRate: 35.2,
        note: "Stable but slower path to completion.",
      },
      {
        label: "19053",
        started: Math.round(totalStarted * 0.15),
        completed: Math.round(totalCompleted * 0.18),
        conversionRate: 43.1,
        note: "Smaller volume, higher average order confidence.",
      },
    ],
    weekdays: [
      {
        label: "Monday",
        started: Math.round(totalStarted * 0.17),
        completed: Math.round(totalCompleted * 0.16),
        conversionRate: 35.1,
        note: "Higher browse volume from weekend research.",
      },
      {
        label: "Tuesday",
        started: Math.round(totalStarted * 0.14),
        completed: Math.round(totalCompleted * 0.15),
        conversionRate: 39.8,
        note: "Steady conversion with shorter completion time.",
      },
      {
        label: "Wednesday",
        started: Math.round(totalStarted * 0.15),
        completed: Math.round(totalCompleted * 0.16),
        conversionRate: 40.9,
        note: "Best mix of volume and finish rate.",
      },
      {
        label: "Thursday",
        started: Math.round(totalStarted * 0.16),
        completed: Math.round(totalCompleted * 0.17),
        conversionRate: 41.5,
        note: "Strong review-step completion before weekend jobs.",
      },
      {
        label: "Friday",
        started: Math.round(totalStarted * 0.14),
        completed: Math.round(totalCompleted * 0.13),
        conversionRate: 34.8,
        note: "More starts, but more deferrals into the weekend.",
      },
      {
        label: "Saturday",
        started: Math.round(totalStarted * 0.13),
        completed: Math.round(totalCompleted * 0.12),
        conversionRate: 33.2,
        note: "Mobile-heavy traffic with more pricing drop-off.",
      },
      {
        label: "Sunday",
        started: Math.round(totalStarted * 0.11),
        completed: Math.round(totalCompleted * 0.11),
        conversionRate: 36.7,
        note: "Return visitors convert well after coming back later.",
      },
    ],
  };
}

export function buildConversionAnalytics(filters: AnalyticsFilters): ConversionAnalyticsData {
  const bookingTrends = buildTrendPoints(filters);
  const started = bookingTrends.reduce((sum, point) => sum + point.started, 0);
  const completed = bookingTrends.reduce((sum, point) => sum + point.completed, 0);
  const funnel = buildMockBookingFunnelData(started, filters);
  const overallConversionRate = (completed / started) * 100;
  const avgCompletionMinutes =
    bookingTrends.reduce((sum, point) => sum + point.avgCompletionMinutes, 0) / bookingTrends.length;
  const returnResumeRate =
    18 + (filters.visitorType === "returning" ? 11 : 0) + (filters.device === "mobile" ? 4 : 0);
  const biggestDropOff = [...funnel].slice(1).sort((a, b) => b.dropOffCount - a.dropOffCount)[0];
  const portalLogins = bookingTrends.reduce((sum, point) => sum + point.portalLogins, 0);
  const uniquePortalUsers = bookingTrends.reduce((sum, point) => sum + point.uniqueUsers, 0);
  const portalAdoptionRate = 58 + (filters.visitorType === "returning" ? 8 : 0) - (filters.product === "concrete" ? 6 : 0);
  const repeatUsageRate = 47 + (filters.visitorType === "returning" ? 10 : 0);
  const selfServiceActions = Math.round(uniquePortalUsers * 1.72);
  const estimatedTimeSavedHours = Math.round(selfServiceActions * 6.5) / 60;
  const breakdowns = buildMockBreakdownData(started, completed);

  const bookingInsights: Insight[] = [
    {
      title: "Pricing is still the biggest abandonment point",
      body: `${number(biggestDropOff.dropOffCount)} sessions fell off before the next step after pricing, making it the clearest place to test messaging, fees, or reassurance.`,
      tone: "orange",
    },
    {
      title: "Mobile traffic is converting below desktop",
      body: `Mobile finishes at 29.9% versus 46.8% on desktop, suggesting quote clarity and form friction matter most on smaller screens.`,
      tone: "blue",
    },
    {
      title: "Customers who come back later are worth tracking",
      body: `${percent(returnResumeRate)} of starters return to resume later, and that group closes at a meaningfully higher rate than first-session bookings.`,
      tone: "emerald",
    },
    {
      title: "Schedule/details is the slowest decision step",
      body: `The schedule/details step adds the most time in-flow, which usually points to date hesitation, placement questions, or unclear service rules.`,
      tone: "blue",
    },
  ];

  const portalInsights: Insight[] = [
    {
      title: "Portal requests are deflecting operational follow-up",
      body: `${number(Math.round(selfServiceActions * 0.64))} actions came through self-service instead of phone or text, with pickup and extension requests leading the way.`,
      tone: "emerald",
    },
    {
      title: "Repeat portal behavior suggests customers find it useful",
      body: `${percent(repeatUsageRate)} of portal users came back for a second action, which is a strong sign the portal is solving real post-booking needs.`,
      tone: "blue",
    },
    {
      title: "Rental detail views are the anchor behavior",
      body: `The most common portal visit is simply checking rental details, which supports reminders, timing confidence, and fewer “what happens next” calls.`,
      tone: "orange",
    },
  ];

  return {
    filters,
    bookingKpis: [
      {
        label: "Booking sessions started",
        value: number(started),
        change: "+12.4%",
        tone: "default",
        helper: "People who entered the booking flow.",
      },
      {
        label: "Completed bookings",
        value: number(completed),
        change: "+15.1%",
        tone: "success",
        helper: "Bookings that reached a completed order.",
      },
      {
        label: "Overall conversion rate",
        value: percent(overallConversionRate),
        change: "+1.2 pts",
        tone: "success",
        helper: "Share of booking starters who finished.",
      },
      {
        label: "Biggest drop-off step",
        value: "Pricing",
        change: `${number(biggestDropOff.dropOffCount)} lost`,
        tone: "warning",
        helper: "Largest abandonment point in the funnel.",
      },
      {
        label: "Average time to complete",
        value: formatMinutes(avgCompletionMinutes),
        change: "-0.9 min",
        tone: "default",
        helper: "From booking start to completed order.",
      },
      {
        label: "Return / resume rate",
        value: percent(returnResumeRate),
        change: "+3.6 pts",
        tone: "default",
        helper: "Sessions resumed after leaving the flow.",
      },
    ],
    funnel,
    bookingInsights,
    bookingTrends,
    breakdowns,
    portalKpis: [
      {
        label: "Portal logins",
        value: number(portalLogins),
        change: "+18.2%",
        tone: "success",
        helper: "Total portal sessions in the selected period.",
      },
      {
        label: "Unique portal users",
        value: number(uniquePortalUsers),
        change: "+10.7%",
        tone: "default",
        helper: "Distinct customers active in the portal.",
      },
      {
        label: "Portal adoption rate",
        value: percent(portalAdoptionRate),
        change: "+4.1 pts",
        tone: "success",
        helper: "Booked customers who used the portal.",
      },
      {
        label: "Repeat usage rate",
        value: percent(repeatUsageRate),
        change: "+5.3 pts",
        tone: "default",
        helper: "Portal users who came back more than once.",
      },
      {
        label: "Self-service actions completed",
        value: number(selfServiceActions),
        change: "+22.0%",
        tone: "success",
        helper: "Completed customer actions without staff intervention.",
      },
      {
        label: "Estimated admin time saved",
        value: `${estimatedTimeSavedHours.toFixed(1)} hrs`,
        change: "+1.8 hrs",
        tone: "success",
        helper: "Estimated phone/text/admin handling avoided.",
      },
    ],
    portalInsights,
    portalFeatureUsage: [
      {
        label: "View rental details",
        count: Math.round(portalLogins * 0.42),
        share: 42,
        trend: "+9%",
        detail: "Most common customer check-in behavior before delivery and pickup.",
      },
      {
        label: "Request pickup",
        count: Math.round(portalLogins * 0.18),
        share: 18,
        trend: "+14%",
        detail: "High-value action that replaces inbound pickup coordination.",
      },
      {
        label: "Request extension",
        count: Math.round(portalLogins * 0.14),
        share: 14,
        trend: "+11%",
        detail: "Customers use this when schedules shift and jobs run longer.",
      },
      {
        label: "Report issue",
        count: Math.round(portalLogins * 0.09),
        share: 9,
        trend: "-3%",
        detail: "Low volume, but useful for routing support with context.",
      },
      {
        label: "Update account info",
        count: Math.round(portalLogins * 0.1),
        share: 10,
        trend: "+6%",
        detail: "Self-serve contact updates reduce simple admin edits.",
      },
      {
        label: "Rebook same setup",
        count: Math.round(portalLogins * 0.07),
        share: 7,
        trend: "+19%",
        detail: "Early repeat-business signal from existing customers.",
      },
    ],
    portalActionUsage: [
      {
        label: "Pickup requests submitted",
        count: Math.round(selfServiceActions * 0.34),
        share: 34,
        trend: "+15%",
        detail: "Likely the largest direct call deflection category.",
      },
      {
        label: "Extension requests submitted",
        count: Math.round(selfServiceActions * 0.23),
        share: 23,
        trend: "+12%",
        detail: "Adds convenience while preserving staff visibility.",
      },
      {
        label: "Rental detail checks",
        count: Math.round(selfServiceActions * 0.2),
        share: 20,
        trend: "+9%",
        detail: "Reduces status update and reminder questions.",
      },
      {
        label: "Account updates",
        count: Math.round(selfServiceActions * 0.13),
        share: 13,
        trend: "+4%",
        detail: "Avoids simple support contacts for profile changes.",
      },
      {
        label: "Issue reports filed",
        count: Math.round(selfServiceActions * 0.1),
        share: 10,
        trend: "-2%",
        detail: "Smallest volume but highest urgency when it happens.",
      },
    ],
    portalValueStats: [
      {
        label: "Pickup requests handled in portal",
        value: number(Math.round(selfServiceActions * 0.34)),
        helper: "Pickup coordination customers completed without texting the office.",
      },
      {
        label: "Extension requests handled in portal",
        value: number(Math.round(selfServiceActions * 0.23)),
        helper: "Schedule changes captured in a structured, trackable way.",
      },
      {
        label: "Support-deflecting actions",
        value: number(Math.round(selfServiceActions * 0.64)),
        helper: "Actions likely to prevent a call, text, or manual follow-up.",
      },
      {
        label: "Estimated calls or texts avoided",
        value: number(Math.round(selfServiceActions * 0.58)),
        helper: "Directional estimate based on common portal actions replacing outreach.",
      },
    ],
  };
}
