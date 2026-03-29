import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getBrandSettings, getCurrentTenant, getSupportSettings, getTenantSettings } from "./server";

export type RetailHeaderSettings = {
  showCallTextButton: boolean;
  phoneNumber: string;
  showLogoInHeader: boolean;
  logoUrl: string;
  logoAlt: string;
  logoStoragePath: string;
  businessNameSize: "small" | "medium" | "large";
  logoSizeMode: "match-name" | "custom";
  customLogoHeight: number;
};

export type RetailHomeVisibilitySettings = {
  showServiceAreaPopup: boolean;
  showFaq: boolean;
};

export type RetailBlockedDate = {
  date: string;
  label: string;
};

export type RetailBlockedRange = {
  startDate: string;
  endDate: string;
  label: string;
};

export type RetailCalendarClosuresSettings = {
  blockedDates: RetailBlockedDate[];
  blockedRanges: RetailBlockedRange[];
};

export type RetailSiteSettings = {
  header: RetailHeaderSettings;
  home: {
    visibility: RetailHomeVisibilitySettings;
  };
  calendarClosures: RetailCalendarClosuresSettings;
};

const SETTINGS_CATEGORY_HEADER = "settings.header";
const SETTINGS_CATEGORY_HOME_VISIBILITY = "settings.home.visibility";
const SETTINGS_CATEGORY_CALENDAR_CLOSURES = "settings.calendarClosures";

function asBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asBusinessNameSize(value: unknown): RetailHeaderSettings["businessNameSize"] {
  return value === "small" || value === "large" ? value : "medium";
}

function asLogoSizeMode(value: unknown): RetailHeaderSettings["logoSizeMode"] {
  return value === "custom" ? "custom" : "match-name";
}

function sanitizeCustomLogoHeight(value: unknown) {
  return Math.max(24, Math.min(96, Math.round(asNumber(value, 48))));
}

function isYmd(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function compareYmd(left: string, right: string) {
  return left.localeCompare(right);
}

function sanitizeBlockedDates(value: unknown): RetailBlockedDate[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const row = entry as Record<string, unknown>;
      const date = asString(row.date);
      if (!isYmd(date)) return null;

      return {
        date,
        label: asString(row.label),
      };
    })
    .filter((entry): entry is RetailBlockedDate => Boolean(entry))
    .sort((left, right) => compareYmd(left.date, right.date));
}

function sanitizeBlockedRanges(value: unknown): RetailBlockedRange[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const row = entry as Record<string, unknown>;
      const startDate = asString(row.startDate);
      const endDate = asString(row.endDate);
      if (!isYmd(startDate) || !isYmd(endDate) || startDate > endDate) return null;

      return {
        startDate,
        endDate,
        label: asString(row.label),
      };
    })
    .filter((entry): entry is RetailBlockedRange => Boolean(entry))
    .sort((left, right) => compareYmd(left.startDate, right.startDate) || compareYmd(left.endDate, right.endDate));
}

export function sanitizeRetailSiteSettings(input: unknown): RetailSiteSettings {
  const value = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const header = value.header && typeof value.header === "object" ? (value.header as Record<string, unknown>) : {};
  const home = value.home && typeof value.home === "object" ? (value.home as Record<string, unknown>) : {};
  const visibility =
    home.visibility && typeof home.visibility === "object"
      ? (home.visibility as Record<string, unknown>)
      : {};
  const calendarClosures =
    value.calendarClosures && typeof value.calendarClosures === "object"
      ? (value.calendarClosures as Record<string, unknown>)
      : {};

  return {
    header: {
      showCallTextButton: asBoolean(header.showCallTextButton, true),
      phoneNumber: asString(header.phoneNumber),
      showLogoInHeader: asBoolean(header.showLogoInHeader, false),
      logoUrl: asString(header.logoUrl),
      logoAlt: asString(header.logoAlt),
      logoStoragePath: asString(header.logoStoragePath),
      businessNameSize: asBusinessNameSize(header.businessNameSize),
      logoSizeMode: asLogoSizeMode(header.logoSizeMode),
      customLogoHeight: sanitizeCustomLogoHeight(header.customLogoHeight),
    },
    home: {
      visibility: {
        showServiceAreaPopup: asBoolean(visibility.showServiceAreaPopup, true),
        showFaq: asBoolean(visibility.showFaq, true),
      },
    },
    calendarClosures: {
      blockedDates: sanitizeBlockedDates(calendarClosures.blockedDates),
      blockedRanges: sanitizeBlockedRanges(calendarClosures.blockedRanges),
    },
  };
}

export async function getRetailSiteSettings(): Promise<RetailSiteSettings> {
  const tenant = await getCurrentTenant();
  const [settings, brand, support] = await Promise.all([
    getTenantSettings(tenant.id),
    getBrandSettings(),
    getSupportSettings(),
  ]);

  const defaultPhoneNumber =
    brand.headerPrimaryCtaType === "tel" && brand.headerPrimaryCtaValue
      ? brand.headerPrimaryCtaValue
      : support.phone ?? "";

  return sanitizeRetailSiteSettings({
    header: {
      showCallTextButton: settings.get(`${SETTINGS_CATEGORY_HEADER}.showCallTextButton`) ?? true,
      phoneNumber: settings.get(`${SETTINGS_CATEGORY_HEADER}.phoneNumber`) ?? defaultPhoneNumber,
      showLogoInHeader: settings.get(`${SETTINGS_CATEGORY_HEADER}.showLogoInHeader`) ?? false,
      logoUrl: settings.get(`${SETTINGS_CATEGORY_HEADER}.logoUrl`) ?? "",
      logoAlt: settings.get(`${SETTINGS_CATEGORY_HEADER}.logoAlt`) ?? "",
      logoStoragePath: settings.get(`${SETTINGS_CATEGORY_HEADER}.logoStoragePath`) ?? "",
      businessNameSize: settings.get(`${SETTINGS_CATEGORY_HEADER}.businessNameSize`) ?? "medium",
      logoSizeMode: settings.get(`${SETTINGS_CATEGORY_HEADER}.logoSizeMode`) ?? "match-name",
      customLogoHeight: settings.get(`${SETTINGS_CATEGORY_HEADER}.customLogoHeight`) ?? 48,
    },
    home: {
      visibility: {
        showServiceAreaPopup: settings.get(`${SETTINGS_CATEGORY_HOME_VISIBILITY}.showServiceAreaPopup`) ?? true,
        showFaq: settings.get(`${SETTINGS_CATEGORY_HOME_VISIBILITY}.showFaq`) ?? true,
      },
    },
    calendarClosures: {
      blockedDates: settings.get(`${SETTINGS_CATEGORY_CALENDAR_CLOSURES}.blockedDates`) ?? [],
      blockedRanges: settings.get(`${SETTINGS_CATEGORY_CALENDAR_CLOSURES}.blockedRanges`) ?? [],
    },
  });
}

export async function saveRetailSiteSettings(input: unknown): Promise<RetailSiteSettings> {
  const tenant = await getCurrentTenant();
  const settings = sanitizeRetailSiteSettings(input);

  if (settings.header.showCallTextButton && !settings.header.phoneNumber) {
    throw new Error("Phone number is required when the Call/Text button is enabled.");
  }

  const { error } = await supabaseAdmin.from("tenant_settings").upsert(
    [
      {
        tenant_id: tenant.id,
        category: SETTINGS_CATEGORY_HEADER,
        key: "showCallTextButton",
        value_json: settings.header.showCallTextButton,
      },
      {
        tenant_id: tenant.id,
        category: SETTINGS_CATEGORY_HEADER,
        key: "phoneNumber",
        value_json: settings.header.phoneNumber,
      },
      {
        tenant_id: tenant.id,
        category: SETTINGS_CATEGORY_HEADER,
        key: "showLogoInHeader",
        value_json: settings.header.showLogoInHeader,
      },
      {
        tenant_id: tenant.id,
        category: SETTINGS_CATEGORY_HEADER,
        key: "logoUrl",
        value_json: settings.header.logoUrl,
      },
      {
        tenant_id: tenant.id,
        category: SETTINGS_CATEGORY_HEADER,
        key: "logoAlt",
        value_json: settings.header.logoAlt,
      },
      {
        tenant_id: tenant.id,
        category: SETTINGS_CATEGORY_HEADER,
        key: "logoStoragePath",
        value_json: settings.header.logoStoragePath,
      },
      {
        tenant_id: tenant.id,
        category: SETTINGS_CATEGORY_HEADER,
        key: "businessNameSize",
        value_json: settings.header.businessNameSize,
      },
      {
        tenant_id: tenant.id,
        category: SETTINGS_CATEGORY_HEADER,
        key: "logoSizeMode",
        value_json: settings.header.logoSizeMode,
      },
      {
        tenant_id: tenant.id,
        category: SETTINGS_CATEGORY_HEADER,
        key: "customLogoHeight",
        value_json: settings.header.customLogoHeight,
      },
      {
        tenant_id: tenant.id,
        category: SETTINGS_CATEGORY_HOME_VISIBILITY,
        key: "showServiceAreaPopup",
        value_json: settings.home.visibility.showServiceAreaPopup,
      },
      {
        tenant_id: tenant.id,
        category: SETTINGS_CATEGORY_HOME_VISIBILITY,
        key: "showFaq",
        value_json: settings.home.visibility.showFaq,
      },
      {
        tenant_id: tenant.id,
        category: SETTINGS_CATEGORY_CALENDAR_CLOSURES,
        key: "blockedDates",
        value_json: settings.calendarClosures.blockedDates,
      },
      {
        tenant_id: tenant.id,
        category: SETTINGS_CATEGORY_CALENDAR_CLOSURES,
        key: "blockedRanges",
        value_json: settings.calendarClosures.blockedRanges,
      },
    ],
    { onConflict: "tenant_id,category,key" },
  );

  if (error) {
    throw new Error(error.message);
  }

  return settings;
}

export function getRetailCalendarClosureForDate(
  date: string,
  settings: RetailSiteSettings,
): { blocked: boolean; label: string | null } {
  if (!isYmd(date)) {
    return { blocked: false, label: null };
  }

  const singleDateMatch = settings.calendarClosures.blockedDates.find((entry) => entry.date === date);
  if (singleDateMatch) {
    return { blocked: true, label: singleDateMatch.label || null };
  }

  const rangeMatch = settings.calendarClosures.blockedRanges.find(
    (entry) => entry.startDate <= date && date <= entry.endDate,
  );
  if (rangeMatch) {
    return { blocked: true, label: rangeMatch.label || null };
  }

  return { blocked: false, label: null };
}
