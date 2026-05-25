import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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

function buildPrimaryCtaHref(type: "tel" | "mailto" | "url", value: string | null) {
  if (!value) return null;

  switch (type) {
    case "mailto":
      return `mailto:${value}`;
    case "url":
      return value;
    default:
      return `tel:${value}`;
  }
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
  const [brand, support, runtime, retailSiteSettings] = await Promise.all([
    getBrandSettings(),
    getSupportSettings(),
    getRuntimeSettings(),
    getRetailSiteSettings(),
  ]);
  const primaryCtaHref = retailSiteSettings.header.showCallTextButton
    ? buildPrimaryCtaHref("tel", retailSiteSettings.header.phoneNumber || support.phone)
    : null;
  const showHeaderLogo =
    retailSiteSettings.header.showLogoInHeader && !!retailSiteSettings.header.logoUrl;
  const logoAlt = retailSiteSettings.header.logoAlt || `${brand.name} logo`;
  const businessNameTextClass = getBusinessNameTextClass(retailSiteSettings.header.businessNameSize);
  const logoHeight = getResolvedLogoHeight(retailSiteSettings.header);

  return (
    <html lang="en" data-tenant-storage-namespace={runtime.storageNamespace}>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <div className="min-h-screen bg-[#F8FAFC]">
          {/* Global Header */}
          <header className="sticky top-0 z-50 bg-[#f5f4f0]/95 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
              <div className="flex min-w-0 items-center gap-3">
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
              </div>
              {primaryCtaHref ? (
                <a
                  className="rounded-2xl border px-4 py-2 text-sm text-[#0F172A] hover:bg-white"
                  style={{ borderColor: "#c0b9ae" }}
                  href={primaryCtaHref}
                >
                  {brand.headerPrimaryCtaLabel || "Call/Text"}
                </a>
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
