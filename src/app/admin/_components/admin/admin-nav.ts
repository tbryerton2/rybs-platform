export type AdminNavItem = {
  label: string;
  href: string;
  icon:
    | "home"
    | "bookings"
    | "schedule"
    | "customers"
    | "financials"
    | "analytics"
    | "portalRequests"
    | "pricing"
    | "zips"
    | "retailSite"
    | "cms"
    | "docs"
    | "system";
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
    items: [{ label: "Overview", href: "/admin", icon: "home", exact: true, matchers: ["/admin"] }],
  },
  {
    label: "Operations",
    items: [
      { label: "Bookings", href: "/admin/bookings", icon: "bookings", matchers: ["/admin/bookings"] },
      {
        label: "Portal requests",
        href: "/admin/portal-requests",
        icon: "portalRequests",
        matchers: ["/admin/portal-requests"],
      },
      { label: "Schedule", href: "/admin/schedule", icon: "schedule", matchers: ["/admin/schedule"] },
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
    label: "Analytics",
    items: [
      {
        label: "Conversion",
        href: "/admin/analytics/conversion",
        icon: "analytics",
        matchers: ["/admin/analytics/conversion"],
      },
      {
        label: "ZIP Heatmap",
        href: "/admin/analytics/zip-heatmap",
        icon: "analytics",
        matchers: ["/admin/analytics/zip-heatmap", "/admin/analytics/zip-map"],
      },
    ],
  },
  {
    label: "Settings",
    items: [
      {
        label: "Pricing",
        href: "/admin/settings/pricing",
        icon: "pricing",
        matchers: ["/admin/settings/pricing"],
      },
      {
        label: "Service ZIPs",
        href: "/admin/settings/zips",
        icon: "zips",
        matchers: ["/admin/settings/zips"],
      },
      {
        label: "Retail Site Settings",
        href: "/admin/settings/retail-site",
        icon: "retailSite",
        matchers: ["/admin/settings/retail-site"],
      },
    ],
  },
  {
    label: "Content",
    items: [{ label: "Content", href: "/admin/cms", icon: "cms", matchers: ["/admin/cms"] }],
  },
  {
    label: "Docs",
    items: [{ label: "Docs", href: "/admin/docs", icon: "docs", matchers: ["/admin/docs"] }],
  },
  {
    label: "System",
    items: [{ label: "System", href: "/admin/system", icon: "system", matchers: ["/admin/system"] }],
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
