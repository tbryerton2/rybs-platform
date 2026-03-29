"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { adminToast } from "@/app/admin/_components/admin/admin-toast";
import type {
  RetailBlockedDate,
  RetailBlockedRange,
  RetailSiteSettings,
} from "@/lib/tenant/retail-site-settings";

type RetailSettingsTab = "header" | "homeVisibility" | "calendarClosures";

const TABS: Array<{ id: RetailSettingsTab; label: string }> = [
  { id: "header", label: "Header" },
  { id: "homeVisibility", label: "Home Visibility" },
  { id: "calendarClosures", label: "Calendar Closures" },
];

function cloneSettings(settings: RetailSiteSettings): RetailSiteSettings {
  return JSON.parse(JSON.stringify(settings)) as RetailSiteSettings;
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-slate-900">{label}</div>
        {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={[
          "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors",
          checked ? "bg-[#F97316]" : "bg-slate-300",
        ].join(" ")}
      >
        <span
          className={[
            "inline-block h-5 w-5 rounded-full bg-white transition-transform",
            checked ? "translate-x-6" : "translate-x-1",
          ].join(" ")}
        />
      </button>
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
  error,
  helperText,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string | null;
  helperText?: string;
}) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-medium text-slate-800">{label}</div>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={[
          "h-12 w-full rounded-2xl border bg-white px-4 text-sm text-slate-900 outline-none transition",
          error
            ? "border-rose-300 focus:border-rose-400 focus:ring-4 focus:ring-rose-100"
            : "border-slate-300 focus:border-[#F97316] focus:ring-4 focus:ring-orange-100",
        ].join(" ")}
      />
      {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
      {!error && helperText ? <p className="mt-2 text-sm text-slate-500">{helperText}</p> : null}
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  helperText,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  helperText?: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-medium text-slate-800">{label}</div>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-[#F97316] focus:ring-4 focus:ring-orange-100"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {helperText ? <p className="mt-2 text-sm text-slate-500">{helperText}</p> : null}
    </label>
  );
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function emptyBlockedDate(): RetailBlockedDate {
  return { date: "", label: "" };
}

function emptyBlockedRange(): RetailBlockedRange {
  return { startDate: "", endDate: "", label: "" };
}

export function RetailSiteSettingsEditor({
  initialSettings,
}: {
  initialSettings: RetailSiteSettings;
}) {
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState<RetailSettingsTab>("header");
  const [settings, setSettings] = useState(() => cloneSettings(initialSettings));
  const [savedSettings, setSavedSettings] = useState(() => cloneSettings(initialSettings));
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirty = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(savedSettings),
    [savedSettings, settings],
  );

  const phoneError =
    settings.header.showCallTextButton && !settings.header.phoneNumber.trim()
      ? "Phone number is required when the Call/Text button is enabled."
      : null;

  const blockedDateError = settings.calendarClosures.blockedDates.find(
    (entry) => !entry.date.trim(),
  )
    ? "Each blocked single-date row needs a date before you can save."
    : null;

  const blockedRangeError = settings.calendarClosures.blockedRanges.find((entry) => {
    const startDate = entry.startDate.trim();
    const endDate = entry.endDate.trim();
    return !startDate || !endDate || startDate > endDate;
  })
    ? "Each blocked range needs both dates, and the end date cannot be before the start date."
    : null;

  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    }

    function onDocumentClick(event: MouseEvent) {
      if (!dirty) return;
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!target) return;
      if (target.getAttribute("target") === "_blank") return;

      const href = target.getAttribute("href");
      if (!href || href.startsWith("#")) return;

      const nextUrl = new URL(href, window.location.href);
      const currentUrl = new URL(window.location.href);
      if (nextUrl.href === currentUrl.href) return;

      if (!window.confirm("You have unsaved retail site settings. Leave this page anyway?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onDocumentClick, true);

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onDocumentClick, true);
    };
  }, [dirty]);

  function updateSettings(updater: (current: RetailSiteSettings) => RetailSiteSettings) {
    setSettings((current) => updater(cloneSettings(current)));
    setError(null);
  }

  async function handleLogoUpload(file: File) {
    setLogoUploadError(null);
    setUploadingLogo(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/admin/settings/retail-site/logo", {
        method: "POST",
        body: formData,
      });
      const json = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        url?: string;
        path?: string;
      };

      if (!response.ok || !json.ok || !json.url || !json.path) {
        throw new Error(json.error || "Logo upload failed.");
      }

      updateSettings((current) => {
        current.header.logoUrl = json.url ?? "";
        current.header.logoStoragePath = json.path ?? "";
        return current;
      });
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : "Logo upload failed.";
      setLogoUploadError(message);
      adminToast.error(message);
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) {
        logoInputRef.current.value = "";
      }
    }
  }

  function handleLogoRemove() {
    updateSettings((current) => {
      current.header.logoUrl = "";
      current.header.logoAlt = "";
      current.header.logoStoragePath = "";
      return current;
    });

    setLogoUploadError(null);
  }

  function updateBlockedDate(index: number, patch: Partial<RetailBlockedDate>) {
    updateSettings((current) => {
      current.calendarClosures.blockedDates[index] = {
        ...current.calendarClosures.blockedDates[index],
        ...patch,
      };
      return current;
    });
  }

  function updateBlockedRange(index: number, patch: Partial<RetailBlockedRange>) {
    updateSettings((current) => {
      current.calendarClosures.blockedRanges[index] = {
        ...current.calendarClosures.blockedRanges[index],
        ...patch,
      };
      return current;
    });
  }

  async function save() {
    if (phoneError) {
      setError(phoneError);
      return;
    }

    if (blockedDateError) {
      setError(blockedDateError);
      return;
    }

    if (blockedRangeError) {
      setError(blockedRangeError);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/settings/retail-site", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const json = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        settings?: RetailSiteSettings;
      };

      if (!response.ok || !json.ok || !json.settings) {
        throw new Error(json.error || "Retail site settings could not be saved.");
      }

      setSettings(cloneSettings(json.settings));
      setSavedSettings(cloneSettings(json.settings));
      adminToast.success("Retail site settings saved.");
    } catch (saveError) {
      const message =
        saveError instanceof Error ? saveError.message : "Retail site settings could not be saved.";
      setError(message);
      adminToast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {TABS.map((tab) => {
              const isActive = tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={[
                    "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900",
                  ].join(" ")}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div
              className={[
                "rounded-full px-3 py-1 text-xs font-semibold",
                dirty ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700",
              ].join(" ")}
            >
              {dirty ? "Unsaved changes" : "All changes saved"}
            </div>

            <button
              type="button"
              onClick={() => void save()}
              disabled={!dirty || saving}
              className="inline-flex items-center justify-center rounded-2xl bg-[#F97316] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}
      </div>

      {activeTab === "header" ? (
        <SectionCard
          title="Header"
          description="Control whether the retail site shows the Call/Text action and which phone number it uses."
        >
          <div className="space-y-4">
            <ToggleRow
              label="Show Call/Text button"
              description="Hide this if the retail site should not show the header contact button."
              checked={settings.header.showCallTextButton}
              onChange={(checked) =>
                updateSettings((current) => {
                  current.header.showCallTextButton = checked;
                  return current;
                })
              }
            />

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="space-y-5">
                <TextInput
                  label="Phone number"
                  value={settings.header.phoneNumber}
                  onChange={(value) =>
                    updateSettings((current) => {
                      current.header.phoneNumber = value;
                      return current;
                    })
                  }
                  placeholder="+1-315-555-0123"
                  error={phoneError}
                  helperText="Stored even when the button is hidden, so it can be turned back on later without re-entering it."
                />

                <ToggleRow
                  label="Show logo in header"
                  description="Displays the uploaded retail logo to the left of the business name."
                  checked={settings.header.showLogoInHeader}
                  onChange={(checked) =>
                    updateSettings((current) => {
                      current.header.showLogoInHeader = checked;
                      return current;
                    })
                  }
                />

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="mb-2 text-sm font-medium text-slate-800">Logo upload</div>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/svg+xml"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void handleLogoUpload(file);
                    }}
                    className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-2xl file:border-0 file:bg-slate-900 file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-800"
                  />
                  <p className="mt-2 text-sm text-slate-500">
                    Upload a JPG, PNG, WEBP, or SVG logo. Re-uploading replaces the saved file reference.
                  </p>
                  {uploadingLogo ? <p className="mt-3 text-sm text-slate-500">Uploading logo...</p> : null}
                  {logoUploadError ? (
                    <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                      {logoUploadError}
                    </div>
                  ) : null}

                  {settings.header.logoUrl ? (
                    <div className="mt-4 space-y-4">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                          Current logo
                        </div>
                        <img
                          src={settings.header.logoUrl}
                          alt={settings.header.logoAlt || "Retail logo preview"}
                          className="h-16 max-w-full object-contain"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleLogoRemove}
                        className="text-sm font-semibold text-slate-600 hover:text-slate-900"
                      >
                        Remove logo
                      </button>
                    </div>
                  ) : null}
                </div>

                <TextInput
                  label="Logo alt text"
                  value={settings.header.logoAlt}
                  onChange={(value) =>
                    updateSettings((current) => {
                      current.header.logoAlt = value;
                      return current;
                    })
                  }
                  placeholder="Tan Can Man logo"
                  helperText="Used when the logo is shown in the retail header."
                />

                <div className="grid gap-5 md:grid-cols-2">
                  <SelectField
                    label="Business name size"
                    value={settings.header.businessNameSize}
                    onChange={(value) =>
                      updateSettings((current) => {
                        current.header.businessNameSize =
                          value === "small" || value === "large" ? value : "medium";
                        return current;
                      })
                    }
                    helperText="Controls the visible size of the business name even when no logo is shown."
                    options={[
                      { value: "small", label: "Small" },
                      { value: "medium", label: "Medium" },
                      { value: "large", label: "Large" },
                    ]}
                  />

                  <SelectField
                    label="Logo size mode"
                    value={settings.header.logoSizeMode}
                    onChange={(value) =>
                      updateSettings((current) => {
                        current.header.logoSizeMode = value === "custom" ? "custom" : "match-name";
                        return current;
                      })
                    }
                    helperText="Match keeps the logo visually balanced with the business name."
                    options={[
                      { value: "match-name", label: "Match business name" },
                      { value: "custom", label: "Custom" },
                    ]}
                  />
                </div>

                {settings.header.logoSizeMode === "custom" ? (
                  <label className="block">
                    <div className="mb-2 text-sm font-medium text-slate-800">Custom logo height</div>
                    <input
                      type="number"
                      min={24}
                      max={96}
                      step={1}
                      value={settings.header.customLogoHeight}
                      onChange={(event) =>
                        updateSettings((current) => {
                          const next = Number(event.target.value);
                          current.header.customLogoHeight = Number.isFinite(next) ? next : 48;
                          return current;
                        })
                      }
                      className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-[#F97316] focus:ring-4 focus:ring-orange-100"
                    />
                    <p className="mt-2 text-sm text-slate-500">
                      Height in pixels. If this is blank or invalid, the header falls back to the match-size behavior.
                    </p>
                  </label>
                ) : null}
              </div>
            </div>
          </div>
        </SectionCard>
      ) : null}

      {activeTab === "homeVisibility" ? (
        <SectionCard
          title="Home Visibility"
          description="Show or hide optional Home features without changing their stored CMS content."
        >
          <div className="space-y-4">
            <ToggleRow
              label="Show Service Area popup"
              description="Controls whether Home can open the service-area popup for unsupported ZIP checks."
              checked={settings.home.visibility.showServiceAreaPopup}
              onChange={(checked) =>
                updateSettings((current) => {
                  current.home.visibility.showServiceAreaPopup = checked;
                  return current;
                })
              }
            />

            <ToggleRow
              label="Show FAQ section"
              description="Hides the FAQ section on Home while keeping the FAQ content stored in CMS."
              checked={settings.home.visibility.showFaq}
              onChange={(checked) =>
                updateSettings((current) => {
                  current.home.visibility.showFaq = checked;
                  return current;
                })
              }
            />
          </div>
        </SectionCard>
      ) : null}

      {activeTab === "calendarClosures" ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <SectionCard
            title="Blocked Single Dates"
            description="Block specific delivery dates from being selected on the booking calendar."
          >
            <div className="space-y-4">
              {settings.calendarClosures.blockedDates.map((entry, index) => (
                <div key={`blocked-date-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
                    <label className="block">
                      <div className="mb-2 text-sm font-medium text-slate-800">Date</div>
                      <input
                        type="date"
                        value={entry.date}
                        onChange={(event) => updateBlockedDate(index, { date: event.target.value })}
                        className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-[#F97316] focus:ring-4 focus:ring-orange-100"
                      />
                    </label>

                    <label className="block">
                      <div className="mb-2 text-sm font-medium text-slate-800">Label / reason</div>
                      <input
                        value={entry.label}
                        onChange={(event) => updateBlockedDate(index, { label: event.target.value })}
                        placeholder="Optional"
                        className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-[#F97316] focus:ring-4 focus:ring-orange-100"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() =>
                        updateSettings((current) => {
                          current.calendarClosures.blockedDates.splice(index, 1);
                          return current;
                        })
                      }
                      className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={() =>
                  updateSettings((current) => {
                    current.calendarClosures.blockedDates.push(emptyBlockedDate());
                    return current;
                  })
                }
                className="inline-flex rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
              >
                Add single date
              </button>
            </div>
          </SectionCard>

          <SectionCard
            title="Blocked Date Ranges"
            description="Block full delivery-date spans while keeping overlap handling simple for V1."
          >
            <div className="space-y-4">
              {settings.calendarClosures.blockedRanges.map((entry, index) => (
                <div key={`blocked-range-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <div className="mb-2 text-sm font-medium text-slate-800">Start date</div>
                      <input
                        type="date"
                        value={entry.startDate}
                        onChange={(event) => updateBlockedRange(index, { startDate: event.target.value })}
                        className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-[#F97316] focus:ring-4 focus:ring-orange-100"
                      />
                    </label>

                    <label className="block">
                      <div className="mb-2 text-sm font-medium text-slate-800">End date</div>
                      <input
                        type="date"
                        value={entry.endDate}
                        onChange={(event) => updateBlockedRange(index, { endDate: event.target.value })}
                        className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-[#F97316] focus:ring-4 focus:ring-orange-100"
                      />
                    </label>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                    <label className="block">
                      <div className="mb-2 text-sm font-medium text-slate-800">Label / reason</div>
                      <input
                        value={entry.label}
                        onChange={(event) => updateBlockedRange(index, { label: event.target.value })}
                        placeholder="Optional"
                        className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-[#F97316] focus:ring-4 focus:ring-orange-100"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() =>
                        updateSettings((current) => {
                          current.calendarClosures.blockedRanges.splice(index, 1);
                          return current;
                        })
                      }
                      className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={() =>
                  updateSettings((current) => {
                    current.calendarClosures.blockedRanges.push(emptyBlockedRange());
                    return current;
                  })
                }
                className="inline-flex rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
              >
                Add blocked range
              </button>
            </div>
          </SectionCard>
        </div>
      ) : null}
    </div>
  );
}
