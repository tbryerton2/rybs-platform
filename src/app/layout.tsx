import type { Metadata } from "next";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import { headers } from "next/headers";
import Link from "next/link";
import { ArrowRightOnRectangleIcon, EnvelopeIcon, PhoneIcon } from "@heroicons/react/24/outline";
import { getRetailSiteSettings } from "@/lib/tenant/retail-site-settings";
import { getBrandSettings, getRuntimeSettings, getSupportSettings } from "@/lib/tenant/server";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const playfairDisplay = Playfair_Display({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
  style: ["normal", "italic"],
  fallback: ["Iowan Old Style", "Georgia", "serif"],
  display: "swap",
});

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function buildMailtoHref(value: string) {
  const email = value.trim();
  return isValidEmail(email) ? `mailto:${email}` : null;
}

function buildTelHref(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  return `tel:${trimmed.startsWith("+") ? `+${digits}` : digits}`;
}

function formatPhoneDisplay(value: string) {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");

  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  return trimmed;
}

function getBusinessNameTextClass(size: "small" | "medium" | "large") {
  switch (size) {
    case "small":
      return "text-base";
    case "large":
      return "text-2xl sm:text-[1.625rem]";
    default:
      return "text-xl sm:text-[1.375rem]";
  }
}

function getMatchedLogoHeight(size: "small" | "medium" | "large") {
  switch (size) {
    case "small":
      return 34;
    case "large":
      return 56;
    default:
      return 44;
  }
}

function getResolvedLogoHeight(header: Awaited<ReturnType<typeof getRetailSiteSettings>>["header"]) {
  if (header.logoSizeMode === "custom") {
    const custom = Number(header.customLogoHeight);
    if (Number.isFinite(custom) && custom >= 24 && custom <= 96) {
      return Math.round(custom);
    }
  }

  return getMatchedLogoHeight(header.businessNameSize);
}

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getBrandSettings();
  const description = [brand.tagline, brand.legalDisplayName].filter(Boolean).join(" • ");

  return {
    title: brand.name,
    description: description || brand.name,
    formatDetection: {
      telephone: false,
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headerStore = await headers();
  const currentPathname = headerStore.get("x-current-pathname") ?? "";
  const isAdminPage = currentPathname === "/admin" || currentPathname.startsWith("/admin/");
  const [brand, support, runtime, retailSiteSettings] = await Promise.all([
    getBrandSettings(),
    getSupportSettings(),
    getRuntimeSettings(),
    getRetailSiteSettings(),
  ]);
  const headerPhoneNumber = retailSiteSettings.header.phoneNumber || support.phone || "";
  const phoneHref = retailSiteSettings.header.showCallTextButton ? buildTelHref(headerPhoneNumber) : null;
  const phoneDisplay = phoneHref ? formatPhoneDisplay(headerPhoneNumber) : null;
  const emailAddress = retailSiteSettings.header.emailAddress;
  const emailHref = retailSiteSettings.header.showEmailInHeader ? buildMailtoHref(emailAddress) : null;
  const showHeaderLogo =
    retailSiteSettings.header.showLogoInHeader && !!retailSiteSettings.header.logoUrl;
  const logoAlt = retailSiteSettings.header.logoAlt || `${brand.name} logo`;
  const businessNameTextClass = getBusinessNameTextClass(retailSiteSettings.header.businessNameSize);
  const logoHeight = getResolvedLogoHeight(retailSiteSettings.header);

  return (
    <html lang="en" data-tenant-storage-namespace={runtime.storageNamespace}>
      <body className={`${geistSans.variable} ${geistMono.variable} ${playfairDisplay.variable} antialiased`}>
        <div className="min-h-screen bg-[#F8FAFC]">
          {/* Global Header */}
          <header
            className={[
              "sticky top-0 z-50 border-b border-slate-200/70 backdrop-blur",
              isAdminPage ? "bg-slate-100/95" : "bg-[#f5f4f0]/95",
            ].join(" ")}
          >
            <div
              className={
                isAdminPage
                  ? "flex w-full items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-5 xl:px-6 2xl:px-8"
                  : "mx-auto flex max-w-6xl items-center justify-between px-6 py-3"
              }
            >
              <Link
                href="/"
                aria-label="Go to homepage"
                className="flex min-w-0 items-center gap-3 transition hover:text-[#EA580C] focus:outline-none focus:ring-4 focus:ring-[#F97316]/20"
              >
                {showHeaderLogo ? (
                  <img
                    src={retailSiteSettings.header.logoUrl}
                    alt={logoAlt}
                    className="w-auto max-w-[180px] shrink-0 object-contain"
                    style={{ height: `${logoHeight}px` }}
                  />
                ) : null}
                <div className={`truncate font-semibold tracking-tight text-[#0F172A] ${businessNameTextClass}`}>
                  {brand.name}
                </div>
              </Link>
              {isAdminPage ? (
                <a
                  href="/admin/logout"
                  target="_self"
                  data-no-prefetch
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white/75 px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-white hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316]/40 focus-visible:ring-offset-2"
                >
                  <ArrowRightOnRectangleIcon className="h-4 w-4" aria-hidden="true" />
                  <span>Sign out</span>
                </a>
              ) : emailHref || (phoneHref && phoneDisplay) ? (
                <div className="ml-4 flex min-w-0 flex-wrap items-center justify-end gap-x-4 gap-y-2 text-sm font-medium text-slate-700">
                  {emailHref ? (
                    <a
                      className="inline-flex min-w-0 max-w-[180px] items-center gap-1.5 transition hover:text-slate-950 sm:max-w-[240px]"
                      href={emailHref}
                    >
                      <EnvelopeIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="truncate">{emailAddress}</span>
                    </a>
                  ) : null}
                  {phoneHref && phoneDisplay ? (
                    <a
                      className="inline-flex shrink-0 items-center gap-1.5 transition hover:text-slate-950"
                      href={phoneHref}
                    >
                      <PhoneIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>{phoneDisplay}</span>
                    </a>
                  ) : null}
                </div>
              ) : null}
            </div>
          </header>

          {children}

          {/* Global Footer */}
          <footer className="bg-gradient-to-b from-slate-900 to-slate-950 text-slate-200">
            <div className="mx-auto max-w-6xl px-6 py-12">
              <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-lg font-semibold tracking-tight text-white">
                    {brand.name}
                  </div>
                  {brand.tagline ? (
                    <div className="mt-1 text-slate-300">
                      {brand.tagline}
                    </div>
                  ) : null}
                  {brand.legalDisplayName ? (
                    <div className="mt-2 text-sm text-slate-400">
                      {brand.legalDisplayName}
                    </div>
                  ) : null}
                </div>

                <div className="text-sm text-slate-400">
                  © {new Date().getFullYear()} {brand.name}. All rights reserved.
                </div>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
