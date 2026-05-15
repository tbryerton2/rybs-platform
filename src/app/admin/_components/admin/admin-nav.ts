export type AdminNavItem = {
  label: string;
  href: string;
  icon:
    | "dashboard"
    | "bookings"
    | "schedule"
    | "customers"
    | "employees"
    | "financials"
    | "expenses"
    | "taxes"
    | "dumpsters"
    | "trucksTrailers"
    | "portalRequests"
    | "pricing"
    | "serviceArea"
    | "retailSiteSettings"
    | "retailSiteContent"
    | "reports"
    | "leadFunnel"
    | "zipHeatmap"
    | "guides"
    | "adminTools";
  exact?: boolean;
  matchers?: string[];
};

export type AdminNavGroup = {
  label: string;
  items: AdminNavItem[];
};

export const adminNavGroups: AdminNavGroup[] = [
  {
    label: "Home",
    items: [{ label: "Dashboard", href: "/admin", icon: "dashboard", exact: true, matchers: ["/admin"] }],
  },
  {
    label: "Operations",
    items: [
      { label: "Schedule", href: "/admin/schedule", icon: "schedule", matchers: ["/admin/schedule"] },
      { label: "Bookings", href: "/admin/bookings", icon: "bookings", matchers: ["/admin/bookings"] },
    ],
  },
  {
    label: "People",
    items: [
      { label: "Customers", href: "/admin/customers", icon: "customers", matchers: ["/admin/customers"] },
      { label: "Employees", href: "/admin/employees", icon: "employees", matchers: ["/admin/employees"] },
    ],
  },
  {
    label: "Financials",
    items: [
      { label: "Pricing", href: "/admin/settings/pricing", icon: "pricing", matchers: ["/admin/settings/pricing"] },
      { label: "Revenue", href: "/admin/financials", icon: "financials", matchers: ["/admin/financials"] },
      { label: "Expenses", href: "/admin/expenses", icon: "expenses", matchers: ["/admin/expenses"] },
      { label: "Taxes", href: "/admin/taxes", icon: "taxes", matchers: ["/admin/taxes"] },
    ],
  },
  {
    label: "Equipment",
    items: [
      {
        label: "Dumpsters",
        href: "/admin/equipment/dumpsters",
        icon: "dumpsters",
        matchers: ["/admin/equipment/dumpsters"],
      },
      {
        label: "Trucks & Trailers",
        href: "/admin/trucks-trailers",
        icon: "trucksTrailers",
        matchers: ["/admin/trucks-trailers", "/admin/equipment/trucks-trailers"],
      },
    ],
  },
  {
    label: "Analytics",
    items: [
      {
        label: "Reports",
        href: "/admin/analytics/reports",
        icon: "reports",
        matchers: ["/admin/analytics/reports"],
      },
      {
        label: "Website Analytics",
        href: "/admin/analytics/conversion",
        icon: "leadFunnel",
        matchers: ["/admin/analytics/conversion"],
      },
      {
        label: "Heatmap",
        href: "/admin/analytics/zip-heatmap",
        icon: "zipHeatmap",
        matchers: ["/admin/analytics/zip-heatmap", "/admin/analytics/zip-map"],
      },
    ],
  },
  {
    label: "Website",
    items: [
      {
        label: "Service Area",
        href: "/admin/settings/zips",
        icon: "serviceArea",
        matchers: ["/admin/settings/zips"],
      },
      {
        label: "Settings",
        href: "/admin/settings/retail-site",
        icon: "retailSiteSettings",
        matchers: ["/admin/settings/retail-site"],
      },
      {
        label: "Content",
        href: "/admin/cms",
        icon: "retailSiteContent",
        matchers: ["/admin/cms"],
      },
    ],
  },
  {
    label: "Support",
    items: [{ label: "Help Guides", href: "/admin/docs", icon: "guides", matchers: ["/admin/docs"] }],
  },
  {
    label: "Admin Tools",
    items: [{ label: "Admin Tools", href: "/admin/system", icon: "adminTools", matchers: ["/admin/system"] }],
  },
];

export function isAdminNavItemActive(pathname: string, item: AdminNavItem) {
  const matchers = item.matchers ?? [item.href];
  return matchers.some((matcher) => {
    if (item.exact) return pathname === matcher;
    return pathname === matcher || pathname.startsWith(`${matcher}/`);
  });
}

export function getActiveAdminNavItem(pathname: string) {
  for (const group of adminNavGroups) {
    const item = group.items.find((entry) => isAdminNavItemActive(pathname, entry));
    if (item) return item;
  }

  return null;
}
