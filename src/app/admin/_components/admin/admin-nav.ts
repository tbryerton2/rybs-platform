export type AdminNavItem = {
  label: string;
  href: string;
  icon:
    | "dashboard"
    | "bookings"
    | "schedule"
    | "customers"
    | "financials"
    | "portalRequests"
    | "pricing"
    | "serviceArea"
    | "retailSiteSettings"
    | "retailSiteContent"
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
    label: "Dashboard",
    items: [{ label: "Dashboard", href: "/admin", icon: "dashboard", exact: true, matchers: ["/admin"] }],
  },
  {
    label: "Operations",
    items: [
      { label: "Schedule", href: "/admin/schedule", icon: "schedule", matchers: ["/admin/schedule"] },
      { label: "Bookings", href: "/admin/bookings", icon: "bookings", matchers: ["/admin/bookings"] },
      {
        label: "Portal Requests",
        href: "/admin/portal-requests",
        icon: "portalRequests",
        matchers: ["/admin/portal-requests"],
      },
    ],
  },
  {
    label: "Customers",
    items: [{ label: "Customers", href: "/admin/customers", icon: "customers", matchers: ["/admin/customers"] }],
  },
  {
    label: "Financials",
    items: [{ label: "Financials", href: "/admin/financials", icon: "financials", matchers: ["/admin/financials"] }],
  },
  {
    label: "Website",
    items: [
      {
        label: "Pricing",
        href: "/admin/settings/pricing",
        icon: "pricing",
        matchers: ["/admin/settings/pricing"],
      },
      {
        label: "Service Area",
        href: "/admin/settings/zips",
        icon: "serviceArea",
        matchers: ["/admin/settings/zips"],
      },
      {
        label: "Retail Site Settings",
        href: "/admin/settings/retail-site",
        icon: "retailSiteSettings",
        matchers: ["/admin/settings/retail-site"],
      },
      {
        label: "Retail Site Content",
        href: "/admin/cms",
        icon: "retailSiteContent",
        matchers: ["/admin/cms"],
      },
    ],
  },
  {
    label: "Analytics",
    items: [
      {
        label: "Lead Funnel",
        href: "/admin/analytics/conversion",
        icon: "leadFunnel",
        matchers: ["/admin/analytics/conversion"],
      },
      {
        label: "ZIP Heatmap",
        href: "/admin/analytics/zip-heatmap",
        icon: "zipHeatmap",
        matchers: ["/admin/analytics/zip-heatmap", "/admin/analytics/zip-map"],
      },
    ],
  },
  {
    label: "Guides",
    items: [{ label: "Guides", href: "/admin/docs", icon: "guides", matchers: ["/admin/docs"] }],
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
