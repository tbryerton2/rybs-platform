import {
  ArrowLeftIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ClipboardDocumentListIcon,
  CreditCardIcon,
  EnvelopeIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  PauseCircleIcon,
  PencilSquareIcon,
  PlayCircleIcon,
  PlusIcon,
  StarIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FormSubmitButton } from "@/app/admin/_components/admin/form-submit-button";
import { AdminPage } from "@/app/admin/_components/admin/admin-page";
import {
  activateBusinessAction,
  activateDomainAction,
  assignBusinessAdminAction,
  checkEmailIdentityAction,
  checkDomainAction,
  deactivateBusinessAction,
  disableEmailIdentityAction,
  disableDomainAction,
  makePrimaryDomainAction,
  provisionDomainAction,
  removeEmailIdentityAction,
  removeDomainAction,
  saveEmailIdentityAction,
  sendTestEmailAction,
  updateImplementationTypeAction,
  updatePaymentModeAction,
} from "@/app/platform-admin/(protected)/businesses/actions";
import { getPlatformDomainIntegrationStatus } from "@/lib/platform-admin/domains";
import { getPlatformEmailIdentityIntegrationStatus } from "@/lib/platform-admin/email-identities";
import {
  getPlatformTenantPaymentSetting,
  listPlatformTenantPaymentConnections,
  type PlatformTenantPaymentConnectionSummary,
  type PlatformTenantPaymentMode,
  type PlatformTenantPaymentSetting,
} from "@/lib/platform-admin/payment-settings";
import { CURRENT_SITE_DEACTIVATION_CONFIRMATION } from "@/lib/platform-admin/tenant-validation";
import { getPlatformTenantDetail, type PlatformTenantDomain } from "@/lib/platform-admin/tenants";
import { getRybManagedEmailSenderConfig } from "@/lib/email/tenant-sender";
import type { TenantEmailIdentity, TenantEmailIdentityStatus } from "@/lib/email/tenant-email-identity";
import type {
  PlatformTenantSummary,
  SetupAreaKey,
  SetupAreaStatus,
  TenantImplementationType,
} from "@/lib/platform-admin/setup-completeness";
import { getConfiguredLocalTenantSlug } from "@/lib/tenant/resolution";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{ tenantId: string }>;
  searchParams?: Promise<{
    status?: string;
    error?: string;
    checkedDomainId?: string;
    checkedEmailIdentity?: string;
  }>;
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not recorded";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function statusLabel(status: SetupAreaStatus) {
  switch (status) {
    case "complete":
      return "Configured";
    case "needs_attention":
      return "Needs attention";
    case "using_defaults":
      return "Using defaults";
    case "not_applicable":
      return "Not applicable";
  }
}

function statusBadgeClassName(status: SetupAreaStatus) {
  return status === "complete"
    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : status === "using_defaults"
      ? "bg-sky-50 text-sky-700 ring-sky-200"
      : status === "not_applicable"
        ? "bg-slate-100 text-slate-600 ring-slate-200"
        : "bg-amber-50 text-amber-700 ring-amber-200";
}

function readinessLabel(status: PlatformTenantSummary["setup"]["readinessStatus"]) {
  switch (status) {
    case "not_started":
      return "Not started";
    case "in_progress":
      return "In progress";
    case "ready_to_launch":
      return "Ready to launch";
    case "active":
      return "Active";
    case "active_setup_incomplete":
      return "Active - setup incomplete";
  }
}

function readinessBadgeClassName(status: PlatformTenantSummary["setup"]["readinessStatus"]) {
  switch (status) {
    case "active":
    case "ready_to_launch":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    case "active_setup_incomplete":
      return "bg-red-50 text-red-700 ring-red-200";
    case "in_progress":
      return "bg-amber-50 text-amber-700 ring-amber-200";
    case "not_started":
      return "bg-slate-100 text-slate-600 ring-slate-200";
  }
}

function launchReadinessIsComplete(status: PlatformTenantSummary["setup"]["readinessStatus"]) {
  return status === "ready_to_launch" || status === "active";
}

const IMPLEMENTATION_OPTIONS: Array<{
  value: TenantImplementationType;
  label: string;
  description: string;
}> = [
  {
    value: "full_site_platform_subdomain",
    label: "Full site - platform subdomain",
    description: "We host the full public website on a platform hostname.",
  },
  {
    value: "full_site_custom_domain",
    label: "Full site - custom domain",
    description: "We host the full public website on the customer's domain.",
  },
  {
    value: "existing_site_hosted_booking",
    label: "Existing website + hosted booking",
    description: "The customer keeps their website and links to our hosted booking flow.",
  },
];

function implementationLabel(type: TenantImplementationType | null) {
  return IMPLEMENTATION_OPTIONS.find((option) => option.value === type)?.label ?? "Not selected";
}

function TenantStatusBadge({ tenant }: { tenant: PlatformTenantSummary }) {
  const active = tenant.status === "active";

  return (
    <span
      className={joinClasses(
        "inline-flex rounded-full px-3 py-1 text-sm font-semibold ring-1 ring-inset",
        active
          ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
          : "bg-slate-100 text-slate-600 ring-slate-200",
      )}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function pageStatusMessage(status?: string, error?: string) {
  if (error) {
    return {
      tone: "error" as const,
      text: error,
    };
  }

  switch (status) {
    case "updated":
      return { tone: "success" as const, text: "Business details were updated." };
    case "activated":
      return { tone: "success" as const, text: "Business was activated." };
    case "deactivated":
      return { tone: "success" as const, text: "Business was deactivated." };
    case "domain-added":
      return { tone: "success" as const, text: "Domain mapping was added and provisioning was checked." };
    case "domain-provisioned":
      return { tone: "success" as const, text: "Vercel provisioning state was updated." };
    case "domain-checked":
      return null;
    case "domain-updated":
      return { tone: "success" as const, text: "Domain mapping was updated." };
    case "domain-activated":
      return { tone: "success" as const, text: "Domain mapping was activated." };
    case "domain-disabled":
      return { tone: "success" as const, text: "Domain mapping was disabled." };
    case "domain-primary":
      return { tone: "success" as const, text: "Primary domain was updated." };
    case "domain-removed":
      return { tone: "success" as const, text: "Domain mapping was removed." };
    case "email-identity-saved":
      return { tone: "success" as const, text: "Email sender identity was saved." };
    case "email-identity-provisioned":
      return { tone: "success" as const, text: "SES email identity provisioning state was updated." };
    case "email-identity-checked":
      return null;
    case "email-identity-disabled":
      return { tone: "success" as const, text: "Email sender identity was disabled." };
    case "email-identity-removed":
      return { tone: "success" as const, text: "Email sender identity was removed." };
    case "test-email-sent":
      return { tone: "success" as const, text: "Test email was sent to the saved Reply-To address." };
    case "implementation-updated":
      return { tone: "success" as const, text: "Implementation type was updated." };
    case "payment-mode-updated":
      return { tone: "success" as const, text: "Payment mode was updated." };
    case "admin-assigned":
      return { tone: "success" as const, text: "Business admin access was assigned." };
    default:
      return null;
  }
}

function Alert({
  tone,
  children,
}: {
  tone: "success" | "warning" | "error";
  children: React.ReactNode;
}) {
  const className =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : tone === "error"
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-amber-200 bg-amber-50 text-amber-800";

  return (
    <div className={joinClasses("rounded-[8px] border px-4 py-3 text-sm leading-6", className)}>
      {children}
    </div>
  );
}

type SetupAction =
  | { kind: "link"; label: string; href: string }
  | { kind: "instruction"; label: string; nextStep: string };

type SetupAreaWorkflow = {
  responsibilityLabel: "Platform Admin action" | "Business Admin action";
  nextStep: string;
  action: SetupAction;
};

function getSetupAreaElementId(areaKey: SetupAreaKey) {
  return `setup-area-${areaKey}`;
}

function getSetupAreaWorkflow(tenantId: string, areaKey: SetupAreaKey): SetupAreaWorkflow {
  switch (areaKey) {
    case "businessRecord":
      return {
        responsibilityLabel: "Platform Admin action",
        nextStep: "Update the business record in Platform Admin.",
        action: {
          kind: "link",
          label: "Edit business",
          href: `/platform-admin/businesses/${tenantId}/edit`,
        },
      };
    case "businessAdminAccess":
      return {
        responsibilityLabel: "Platform Admin action",
        nextStep: "Assign an existing Supabase Auth user as a business owner.",
        action: {
          kind: "link",
          label: "Add admin",
          href: "#business-admin-access",
        },
      };
    case "publicDomains":
      return {
        responsibilityLabel: "Platform Admin action",
        nextStep: "Add or activate the public domain for the selected implementation type.",
        action: {
          kind: "link",
          label: "Manage domains",
          href: "#public-domains",
        },
      };
    case "brandContactSettings":
      return {
        responsibilityLabel: "Business Admin action",
        nextStep: "Have the business owner complete this in Business Admin -> Settings.",
        action: {
          kind: "instruction",
          label: "Business Admin -> Settings",
          nextStep: "Have the business owner open Business Admin -> Settings.",
        },
      };
    case "pricing":
      return {
        responsibilityLabel: "Business Admin action",
        nextStep: "Have the business owner complete this in Business Admin -> Pricing.",
        action: {
          kind: "instruction",
          label: "Business Admin -> Pricing",
          nextStep: "Have the business owner open Business Admin -> Pricing.",
        },
      };
    case "serviceArea":
      return {
        responsibilityLabel: "Business Admin action",
        nextStep: "Have the business owner complete this in Business Admin -> Service Area.",
        action: {
          kind: "instruction",
          label: "Business Admin -> Service Area",
          nextStep: "Have the business owner open Business Admin -> Service Area.",
        },
      };
    case "productsInventory":
      return {
        responsibilityLabel: "Business Admin action",
        nextStep: "Have the business owner complete this in Business Admin -> Dumpsters.",
        action: {
          kind: "instruction",
          label: "Business Admin -> Dumpsters",
          nextStep: "Have the business owner open Business Admin -> Dumpsters.",
        },
      };
    case "websiteContent":
      return {
        responsibilityLabel: "Business Admin action",
        nextStep: "Have the business owner complete this in Business Admin -> Content.",
        action: {
          kind: "instruction",
          label: "Business Admin -> Content",
          nextStep: "Have the business owner open Business Admin -> Content.",
        },
      };
  }
}

function actionLabelForArea(area: PlatformTenantSummary["setup"]["areas"][number]) {
  return area.status === "not_applicable"
    ? "No action needed"
    : getSetupAreaWorkflow("", area.key).responsibilityLabel;
}

function missingText(area: PlatformTenantSummary["setup"]["areas"][number]) {
  if (area.status === "complete") return "No missing setup.";
  if (area.status === "not_applicable") return "This area does not block launch.";
  if (area.status === "using_defaults") return "Published tenant content has not been configured.";

  switch (area.key) {
    case "businessRecord":
      return "Valid business name, slug, or lifecycle status.";
    case "businessAdminAccess":
      return "At least one active business admin owner.";
    case "brandContactSettings":
      return area.detail
        .replace(/^Missing /, "")
        .replace(/\.$/, "")
        .replace("brand.name", "Brand name")
        .replace("support.timezone", "Support timezone")
        .replace("runtime.storageNamespace", "Storage namespace");
    case "pricing":
      return "Saved pricing for this business.";
    case "serviceArea":
      return "At least one active service ZIP.";
    case "productsInventory":
      return "At least one active/bookable dumpster or public product.";
    case "websiteContent":
      return "Published website content.";
    case "publicDomains":
      return "An active domain matching the selected implementation type.";
  }
}

function SetupAreaCard({
  tenant,
  area,
}: {
  tenant: PlatformTenantSummary;
  area: PlatformTenantSummary["setup"]["areas"][number];
}) {
  const Icon = area.status === "needs_attention"
    ? ExclamationTriangleIcon
    : area.status === "complete"
      ? CheckCircleIcon
      : InformationCircleIcon;
  const workflow = getSetupAreaWorkflow(tenant.id, area.key);
  const action = workflow.action;
  const responsibilityLabel = actionLabelForArea(area);
  const responsibilityClassName =
    responsibilityLabel === "No action needed"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : responsibilityLabel === "Platform Admin action"
        ? "bg-sky-50 text-sky-700 ring-sky-200"
        : "bg-violet-50 text-violet-700 ring-violet-200";

  return (
    <article
      id={getSetupAreaElementId(area.key)}
      className="scroll-mt-6 rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <div
          className={joinClasses(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] ring-1 ring-inset",
            area.status === "needs_attention"
              ? "bg-amber-50 text-amber-700 ring-amber-200"
              : area.status === "complete"
                ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                : "bg-sky-50 text-sky-700 ring-sky-200",
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900">{area.label}</h3>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
                {area.required ? "Required" : "Optional"}
              </span>
              <span
                className={joinClasses(
                  "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
                  statusBadgeClassName(area.status),
                )}
              >
                {statusLabel(area.status)}
              </span>
              <span
                className={joinClasses(
                  "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
                  responsibilityClassName,
                )}
              >
                {responsibilityLabel}
              </span>
            </div>
          </div>
          <div className="mt-3 grid gap-3 text-sm leading-6">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Missing</div>
              <p className="mt-1 text-slate-800">{missingText(area)}</p>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Next step</div>
              <p className="mt-1 text-slate-800">
                {area.status === "complete"
                  ? "No action needed. Keep this area updated if the business changes."
                  : area.status === "not_applicable"
                    ? area.needed
                  : workflow.nextStep}
              </p>
            </div>
            <p className="text-slate-600">{area.detail}</p>
          </div>
          <div className="mt-4">
            {action.kind === "link" ? (
              <Link href={action.href} className="admin-btn admin-btn-secondary admin-btn-sm">
                {action.label}
              </Link>
            ) : (
              <div className="grid gap-2">
                <span className="inline-flex min-h-8 w-fit items-center rounded-[8px] border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-600">
                  {area.status === "complete" ? "Managed in" : "Complete in"} {action.label}
                </span>
                <p className="text-xs leading-5 text-slate-500">{action.nextStep}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function formatDomainType(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function DomainStatusBadge({ status }: { status: string }) {
  const className =
    status === "active"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : status === "pending"
        ? "bg-amber-50 text-amber-700 ring-amber-200"
        : "bg-slate-100 text-slate-600 ring-slate-200";

  return (
    <span className={joinClasses("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset", className)}>
      {status}
    </span>
  );
}

function providerStatusLabel(domain: PlatformTenantDomain) {
  switch (domain.providerStatus) {
    case "not_provisioned":
      return "Pending setup";
    case "provisioning":
      return "Provisioning";
    case "awaiting_dns":
      return "DNS required";
    case "awaiting_verification":
      return "Verification required";
    case "ready":
      return domain.status === "active" ? null : "Ready to activate";
    case "error":
      return "Provider error";
    default:
      return null;
  }
}

function ProviderStatusBadge({ domain }: { domain: PlatformTenantDomain }) {
  const label = providerStatusLabel(domain);
  if (!label) return null;

  const className =
    domain.providerStatus === "ready"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : domain.providerStatus === "error"
        ? "bg-red-50 text-red-700 ring-red-200"
        : domain.providerStatus === "awaiting_dns" || domain.providerStatus === "awaiting_verification"
          ? "bg-amber-50 text-amber-700 ring-amber-200"
          : "bg-slate-100 text-slate-600 ring-slate-200";

  return (
    <span className={joinClasses("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset", className)}>
      {label}
    </span>
  );
}

function domainCanActivate(domain: PlatformTenantDomain) {
  return domain.status !== "active" && domain.providerStatus === "ready";
}

function getDnsInstructionRecords(domain: PlatformTenantDomain) {
  const instructions = domain.dnsInstructions as
    | { records?: Array<{ type?: string; name?: string; value?: string; reason?: string | null }>; notes?: string[] }
    | null
    | undefined;

  return {
    records: (instructions?.records ?? []).filter((record) => record.type && record.name && record.value),
    notes: instructions?.notes ?? [],
  };
}

function DomainDnsInstructions({ domain }: { domain: PlatformTenantDomain }) {
  const { records, notes } = getDnsInstructionRecords(domain);
  const guidance = [...new Set([
    ...records.flatMap((record) => record.reason ? [record.reason] : []),
    ...notes,
  ])];

  if (records.length === 0 && notes.length === 0 && !domain.lastError) {
    return null;
  }

  return (
    <div className="-mx-4 mt-6 grid gap-4 border-y border-slate-200 bg-slate-50 px-4 py-5">
      <h3 className="text-sm font-semibold text-slate-900">DNS setup</h3>
      {domain.lastError ? (
        <Alert tone="error">{domain.lastError}</Alert>
      ) : null}
      {records.length ? (
        <div className="overflow-hidden rounded-[8px] border border-slate-200 bg-white">
          <div className="grid grid-cols-[88px_minmax(0,1fr)_minmax(0,1.3fr)] divide-x divide-slate-200 border-b border-slate-200 bg-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-600">
            <div className="px-3 py-2">Type</div>
            <div className="px-3 py-2">Name</div>
            <div className="px-3 py-2">Value</div>
          </div>
          <div className="divide-y divide-slate-100">
            {records.map((record, index) => (
              <div
                key={`${record.type}-${record.name}-${index}`}
                className="text-xs"
              >
                <div className="grid grid-cols-[88px_minmax(0,1fr)_minmax(0,1.3fr)] divide-x divide-slate-200">
                <div className="px-3 py-3 font-mono font-semibold text-slate-900">{record.type}</div>
                <div className="min-w-0 px-3 py-3">
                <input
                  readOnly
                  value={record.name}
                  className="w-full min-w-0 rounded-[8px] border border-slate-200 bg-white px-2 py-1 font-mono text-slate-800"
                  aria-label={`${domain.hostname} DNS record name`}
                />
                </div>
                <div className="min-w-0 px-3 py-3">
                <input
                  readOnly
                  value={record.value}
                  className="w-full min-w-0 rounded-[8px] border border-slate-200 bg-white px-2 py-1 font-mono text-slate-800"
                  aria-label={`${domain.hostname} DNS record value`}
                />
                </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {guidance.length ? (
        <div className="grid gap-1 border-l-2 border-slate-200 pl-3 text-xs leading-5 text-slate-600">
          <p className="font-semibold text-slate-700">DNS setup notes</p>
          {guidance.map((note) => (
            <p key={note}>{note}</p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TenantDomainsSection({
  tenant,
  domains,
  checkedDomainId,
}: {
  tenant: PlatformTenantSummary;
  domains: PlatformTenantDomain[];
  checkedDomainId?: string;
}) {
  const activeDomains = domains.filter((domain) => domain.status === "active");
  const hasActiveDomainWithoutPrimary = activeDomains.length > 0 &&
    !domains.some((domain) => domain.isPrimary);
  const hasPendingCustomDomain = domains.some(
    (domain) => domain.domainType === "custom_domain" && domain.status === "pending",
  );
  const hasInactivePrimary = domains.some(
    (domain) => domain.isPrimary && domain.status !== "active",
  );
  const primaryDomain = domains.find((domain) => domain.isPrimary) ?? null;
  const otherDomains = primaryDomain
    ? domains.filter((domain) => domain.id !== primaryDomain.id)
    : domains;
  const otherDomainsNeedAttention = otherDomains.some(
    (domain) =>
      domain.status !== "disabled" &&
      (domain.status !== "active" ||
        domain.providerStatus === "not_provisioned" ||
        domain.providerStatus === "error" ||
        domain.providerStatus === "awaiting_dns" ||
        domain.verificationStatus === "verification_required"),
  );

  return (
    <section id="public-domains" className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-slate-900">Public domains</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Hostnames that can resolve this business on the public site.
          </p>
        </div>
        <Link
          href={`/platform-admin/businesses/${tenant.id}/domains/new`}
          className="admin-btn admin-btn-secondary"
        >
          <PlusIcon className="h-4 w-4" />
          Add domain
        </Link>
      </div>

      <div className="mt-4 grid gap-3">
        {tenant.status === "active" && activeDomains.length === 0 ? (
          <Alert tone="warning">
            This active business has no active production public domain. Localhost development compatibility does not count here.
          </Alert>
        ) : null}
        {hasPendingCustomDomain ? (
          <Alert tone="warning">
            A custom domain is pending. It will not resolve publicly until it is activated.
          </Alert>
        ) : null}
        {hasInactivePrimary ? (
          <Alert tone="warning">
            A primary domain is not active. Edit it, activate it, or choose another primary domain.
          </Alert>
        ) : null}
        {hasActiveDomainWithoutPrimary ? (
          <Alert tone="warning">
            This business has active public domains, but no primary domain is selected.
          </Alert>
        ) : null}
      </div>

      {domains.length ? (
        <div className="mt-4 grid gap-3">
          {primaryDomain ? (
            <TenantDomainCard
              tenantId={tenant.id}
              domain={primaryDomain}
              activeDomainCount={activeDomains.length}
              checkedDomainId={checkedDomainId}
            />
          ) : null}
          {otherDomains.length ? (
            <details className="group rounded-[8px] border border-slate-200 bg-white">
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-slate-900">
                <span className="inline-flex items-center gap-2">
                  <ChevronDownIcon className="h-4 w-4 text-slate-500 transition-transform group-open:rotate-180" />
                  Other domains
                </span>
                <span
                  className={joinClasses(
                    "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
                    otherDomainsNeedAttention
                      ? "bg-amber-50 text-amber-700 ring-amber-200"
                      : "bg-slate-100 text-slate-600 ring-slate-200",
                  )}
                >
                  {otherDomainsNeedAttention
                    ? "Needs attention"
                    : `${otherDomains.length} saved`}
                </span>
              </summary>
              <div className="grid gap-3 border-t border-slate-100 p-3">
                {otherDomains.map((domain) => (
                  <TenantDomainCard
                    key={domain.id}
                    tenantId={tenant.id}
                    domain={domain}
                    activeDomainCount={activeDomains.length}
                    checkedDomainId={checkedDomainId}
                  />
                ))}
              </div>
            </details>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 rounded-[8px] border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-600">
          No public domain mappings have been added for this business.
        </div>
      )}
    </section>
  );
}

function TenantDomainCard({
  tenantId,
  domain,
  activeDomainCount,
  checkedDomainId,
}: {
  tenantId: string;
  domain: PlatformTenantDomain;
  activeDomainCount: number;
  checkedDomainId?: string;
}) {
  const isOnlyActiveDomain = domain.status === "active" && activeDomainCount <= 1;

  return (
    <details
      id={`domain-${domain.id}`}
      className="group/domain scroll-mt-6 rounded-[8px] border border-slate-200"
    >
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden">
          <span className="flex min-w-0 items-center gap-2 font-mono text-sm font-semibold text-slate-900">
            <ChevronDownIcon className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-open/domain:rotate-180" />
            <span className="break-all">
            {domain.hostname}
            </span>
          </span>
          <span className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <DomainStatusBadge status={domain.status} />
            <ProviderStatusBadge domain={domain} />
            {domain.verificationStatus === "verification_required" ? (
              <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
                Ownership TXT required
              </span>
            ) : null}
            {domain.isPrimary ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 font-semibold text-sky-700 ring-1 ring-inset ring-sky-200">
                <StarIcon className="h-3.5 w-3.5" />
                Primary
              </span>
            ) : null}
          </span>
      </summary>
      <div className="border-t border-slate-100 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 text-xs text-slate-600">
          <span>{formatDomainType(domain.domainType)}</span>
          <span>Created {formatDateTime(domain.createdAt)}</span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link
            href={`/platform-admin/businesses/${tenantId}/domains/${domain.id}`}
            className="admin-btn !border-amber-300 !bg-amber-50 !text-amber-700 hover:!border-amber-400 hover:!bg-amber-100"
          >
            <PencilSquareIcon className="h-4 w-4" />
            Edit
          </Link>
          {domain.providerStatus === "not_provisioned" || domain.providerStatus === "error" ? (
            <form action={provisionDomainAction}>
              <input type="hidden" name="tenantId" value={tenantId} />
              <input type="hidden" name="domainId" value={domain.id} />
              <button type="submit" className="admin-btn !border-violet-300 !bg-violet-50 !text-violet-700 hover:!border-violet-400 hover:!bg-violet-100">
                <PlayCircleIcon className="h-4 w-4" />
                Provision on Vercel
              </button>
            </form>
          ) : null}
          {domain.providerStatus !== "not_provisioned" ? (
            <form action={checkDomainAction}>
              <input type="hidden" name="tenantId" value={tenantId} />
              <input type="hidden" name="domainId" value={domain.id} />
              <button type="submit" className="admin-btn !border-sky-300 !bg-sky-50 !text-sky-700 hover:!border-sky-400 hover:!bg-sky-100">
                <CheckCircleIcon className="h-4 w-4" />
                Check domain
              </button>
            </form>
          ) : null}
          {domainCanActivate(domain) ? (
            <form action={activateDomainAction}>
              <input type="hidden" name="tenantId" value={tenantId} />
              <input type="hidden" name="domainId" value={domain.id} />
              <button type="submit" className="admin-btn !border-emerald-300 !bg-emerald-50 !text-emerald-700 hover:!border-emerald-400 hover:!bg-emerald-100">
                <PlayCircleIcon className="h-4 w-4" />
                Activate
              </button>
            </form>
          ) : null}
          {domain.status !== "disabled" ? (
            <form action={disableDomainAction}>
              <input type="hidden" name="tenantId" value={tenantId} />
              <input type="hidden" name="domainId" value={domain.id} />
              <button type="submit" className="admin-btn !border-rose-300 !bg-rose-50 !text-rose-700 hover:!border-rose-400 hover:!bg-rose-100">
                <PauseCircleIcon className="h-4 w-4" />
                Disable
              </button>
            </form>
          ) : null}
          {domain.status === "active" && !domain.isPrimary ? (
            <form action={makePrimaryDomainAction}>
              <input type="hidden" name="tenantId" value={tenantId} />
              <input type="hidden" name="domainId" value={domain.id} />
              <button type="submit" className="admin-btn !border-sky-300 !bg-sky-50 !text-sky-700 hover:!border-sky-400 hover:!bg-sky-100">
                <StarIcon className="h-4 w-4" />
                Make primary
              </button>
            </form>
          ) : null}
        </div>
      </div>

      {checkedDomainId === domain.id ? (
        <div className="mt-4">
          <Alert tone="success">Domain configuration was re-checked.</Alert>
        </div>
      ) : null}

      <DomainDnsInstructions domain={domain} />

      <form action={removeDomainAction} className="mt-6 grid gap-3 pb-1 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <h3 className="text-sm font-semibold text-slate-900 md:col-span-2">Remove domain</h3>
        <input type="hidden" name="tenantId" value={tenantId} />
        <input type="hidden" name="domainId" value={domain.id} />
        <div>
          <label htmlFor={`remove-${domain.id}`} className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Remove confirmation
          </label>
          <input
            id={`remove-${domain.id}`}
            name="confirmation"
            type="text"
            placeholder={`Enter ${domain.hostname} to remove`}
            className="mt-1 block h-10 w-full rounded-[8px] border border-slate-300 px-3 font-mono text-xs text-slate-900 shadow-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
          />
        </div>
        <button type="submit" className="admin-btn !h-10 !border-red-300 !bg-red-50 !text-red-700 hover:!border-red-400 hover:!bg-red-100">
          <TrashIcon className="h-4 w-4" />
          Remove
        </button>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-600 md:col-span-2">
            {domain.isPrimary ? (
              <label className="inline-flex items-center gap-2">
                <input name="clearPrimary" type="checkbox" className="h-4 w-4 rounded border-slate-300" />
                Clear primary state
              </label>
            ) : null}
            {isOnlyActiveDomain ? (
              <label className="inline-flex items-center gap-2">
                <input name="acknowledgeLastActive" type="checkbox" className="h-4 w-4 rounded border-slate-300" />
                Remove only active domain
              </label>
            ) : null}
          </div>
      </form>
      </div>
    </details>
  );
}

function LaunchReadinessSection({ tenant }: { tenant: PlatformTenantSummary }) {
  const missingAreas = tenant.setup.missingRequiredAreas;
  const readinessComplete = launchReadinessIsComplete(tenant.setup.readinessStatus);
  const hasReadinessWarnings = !tenant.setup.implementationTypeConfigured || missingAreas.length > 0;

  return (
    <section className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight text-slate-900">Launch readiness</h2>
            {readinessComplete ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                <CheckCircleIcon className="h-3.5 w-3.5" />
                Completed
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Required complete: {tenant.setup.requiredCompleteCount} / {tenant.setup.requiredAreaCount}
          </p>
          <a
            href="#setup-checklist"
            className="mt-2 inline-flex text-sm font-semibold text-sky-700 underline-offset-4 hover:text-sky-900 hover:underline focus:outline-none focus:ring-2 focus:ring-sky-200"
          >
            View setup checklist
          </a>
        </div>
        <span
          className={joinClasses(
            "inline-flex rounded-full px-3 py-1 text-sm font-semibold ring-1 ring-inset",
            readinessBadgeClassName(tenant.setup.readinessStatus),
          )}
        >
          {readinessLabel(tenant.setup.readinessStatus)}
        </span>
      </div>

      {hasReadinessWarnings ? (
        <div className="mt-4 grid gap-3">
          {!tenant.setup.implementationTypeConfigured ? (
            <Alert tone="warning">
              Select an implementation type before treating this business as ready to launch.
            </Alert>
          ) : null}
          {missingAreas.length ? (
            <div className="rounded-[8px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <div className="font-semibold">Missing required setup</div>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {missingAreas.map((area) => (
                  <li key={area.key}>
                    <a
                      href={`#${getSetupAreaElementId(area.key)}`}
                      className="font-semibold text-amber-900 underline-offset-4 hover:text-amber-950 hover:underline focus:outline-none focus:ring-2 focus:ring-amber-300"
                    >
                      {area.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function ImplementationTypeSection({ tenant }: { tenant: PlatformTenantSummary }) {
  return (
    <section className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-slate-900">Implementation type</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Current selection: {implementationLabel(tenant.setup.implementationType)}
          </p>
        </div>
      </div>

      <form action={updateImplementationTypeAction} className="mt-5 space-y-4">
        <input type="hidden" name="tenantId" value={tenant.id} />
        <div className="grid gap-3">
          <label className="flex cursor-pointer items-start gap-3 rounded-[8px] border border-slate-200 bg-white p-3 ring-1 ring-transparent has-[:checked]:border-sky-400 has-[:checked]:ring-sky-100">
            <input
              type="radio"
              name="implementationType"
              value=""
              defaultChecked={!tenant.setup.implementationType}
              className="mt-1 h-4 w-4 border-slate-300 text-sky-600 focus:ring-sky-500"
            />
            <span>
              <span className="block text-sm font-semibold text-slate-900">Not selected</span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">
                Keep readiness blocked until the launch approach is known.
              </span>
            </span>
          </label>
          {IMPLEMENTATION_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-start gap-3 rounded-[8px] border border-slate-200 bg-white p-3 ring-1 ring-transparent has-[:checked]:border-sky-400 has-[:checked]:ring-sky-100"
            >
              <input
                type="radio"
                name="implementationType"
                value={option.value}
                defaultChecked={tenant.setup.implementationType === option.value}
                className="mt-1 h-4 w-4 border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              <span>
                <span className="block text-sm font-semibold text-slate-900">{option.label}</span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">{option.description}</span>
              </span>
            </label>
          ))}
        </div>
        <FormSubmitButton loadingLabel="Saving...">Save implementation type</FormSubmitButton>
      </form>
    </section>
  );
}

function formatRetailWebsiteAddressType(domainType: string) {
  switch (domainType) {
    case "platform_subdomain":
      return "RYBS subdomain";
    case "custom_domain":
      return "Custom domain";
    default:
      return formatDomainType(domainType);
  }
}

function DomainIntegrationStatusSection({ domains }: { domains: PlatformTenantDomain[] }) {
  const status = getPlatformDomainIntegrationStatus();
  const retailWebsiteDomains = domains.filter(
    (domain) => domain.domainType === "platform_subdomain" || domain.domainType === "custom_domain",
  );
  const retailWebsiteAddress = retailWebsiteDomains.find((domain) => domain.isPrimary) ?? null;
  const hasRetailWebsiteAddresses = retailWebsiteDomains.length > 0;
  const retailWebsiteAddressReady = retailWebsiteAddress?.status === "active";
  const configurationNeedsAttention = !retailWebsiteAddressReady || !status.tokenConfigured;

  return (
    <section className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-slate-900">
            Retail website address configuration
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Shows the website address customers use to reach this business&apos;s retail site.
          </p>
        </div>
        <span
          className={joinClasses(
            "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
            retailWebsiteAddressReady
              ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
              : retailWebsiteAddress
                ? "bg-amber-50 text-amber-700 ring-amber-200"
                : "bg-slate-100 text-slate-600 ring-slate-200",
          )}
        >
          {retailWebsiteAddressReady ? "Ready" : retailWebsiteAddress ? "Needs attention" : "No primary address"}
        </span>
      </div>

      <div className="mt-4 rounded-[8px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
        {retailWebsiteAddressReady ? (
          <p className="flex items-center gap-2">
            <CheckCircleIcon className="h-5 w-5 shrink-0 text-emerald-600" />
            <span>This business has an active retail website address.</span>
          </p>
        ) : retailWebsiteAddress ? (
          <p>This business has a retail website address, but it is not active yet.</p>
        ) : hasRetailWebsiteAddresses ? (
          <p>This business has retail website addresses, but no primary address is selected.</p>
        ) : (
          <p>No retail website address has been added for this business yet.</p>
        )}
      </div>

      <details
        className="group mt-4 rounded-[8px] border border-slate-200 bg-white"
        open={configurationNeedsAttention}
      >
        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-slate-900">
          <span className="inline-flex items-center gap-2">
            <ChevronDownIcon className="h-4 w-4 text-slate-500 transition-transform group-open:rotate-180" />
            Configuration details
          </span>
          <span
            className={joinClasses(
              "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
              configurationNeedsAttention
                ? "bg-amber-50 text-amber-700 ring-amber-200"
                : "bg-emerald-50 text-emerald-700 ring-emerald-200",
            )}
          >
            {configurationNeedsAttention ? "Needs attention" : "Completed"}
          </span>
        </summary>
        <dl className="grid gap-3 border-t border-slate-100 p-3 text-sm sm:grid-cols-2">
          <div className="rounded-[8px] border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Retail website address</dt>
              {retailWebsiteAddress ? (
                <div className="flex flex-wrap justify-end gap-2">
                  <span
                    className={joinClasses(
                      "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
                      retailWebsiteAddressReady
                        ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                        : "bg-amber-50 text-amber-700 ring-amber-200",
                    )}
                  >
                    {retailWebsiteAddressReady ? "Connected" : "Needs attention"}
                  </span>
                  {retailWebsiteAddressReady ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                      <CheckCircleIcon className="h-3.5 w-3.5" />
                      Completed
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
            <dd className="mt-1">
              <span className="break-all text-slate-900">
                {retailWebsiteAddress?.hostname ?? "No primary address selected"}
              </span>
            </dd>
            <dd className="mt-1 text-xs leading-5 text-slate-500">
              {retailWebsiteAddress
                ? retailWebsiteAddressReady
                  ? `This ${formatRetailWebsiteAddressType(retailWebsiteAddress.domainType).toLowerCase()} opens this business's retail site.`
                  : `This ${formatRetailWebsiteAddressType(retailWebsiteAddress.domainType).toLowerCase()} is selected, but it is not connected yet.`
                : hasRetailWebsiteAddresses
                  ? "Choose the public address customers should use for this business's retail site."
                  : "Add the public address customers should use for this business's retail site."}
            </dd>
          </div>
          <div className="rounded-[8px] border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Access token</dt>
              <span
                className={joinClasses(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
                  status.tokenConfigured
                    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                    : "bg-amber-50 text-amber-700 ring-amber-200",
                )}
              >
                {status.tokenConfigured ? <CheckCircleIcon className="h-3.5 w-3.5" /> : null}
                {status.tokenConfigured ? "Completed" : "Missing"}
              </span>
            </div>
            <dd className="mt-1 text-xs leading-5 text-slate-500">
              RYBS needs permission to manage website addresses, which requires a secure access key to be configured in
              Vercel and saved in RYBS. Once that key is saved, RYBS is allowed to ask Vercel to add, check, or remove
              website addresses for retail sites.
            </dd>
          </div>
        </dl>
      </details>
    </section>
  );
}

function EmailIdentityStatusBadge({ status }: { status: TenantEmailIdentityStatus }) {
  const className =
    status === "verified"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : status === "failed"
        ? "bg-red-50 text-red-700 ring-red-200"
        : status === "dns_required"
          ? "bg-amber-50 text-amber-700 ring-amber-200"
          : "bg-slate-100 text-slate-600 ring-slate-200";
  const label =
    status === "dns_required"
      ? "DNS required"
      : status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <span className={joinClasses("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset", className)}>
      {label}
    </span>
  );
}

function getEmailIdentityActionRequired(status: TenantEmailIdentityStatus) {
  if (status === "dns_required" || status === "pending") {
    return {
      label: "DNS Required",
      message: "Email address has not been approved yet in Amazon SES.",
    };
  }

  if (status === "failed") {
    return {
      label: "Action Required",
      message: "Amazon SES could not approve this email address.",
    };
  }

  if (status === "disabled") {
    return {
      label: "Action Required",
      message: "This email address is disabled.",
    };
  }

  return null;
}

function getEmailDnsInstructionRecords(identity: TenantEmailIdentity) {
  const instructions = identity.dnsInstructions as
    | { records?: Array<{ type?: string; name?: string; value?: string; reason?: string | null }>; notes?: string[] }
    | null
    | undefined;

  return {
    records: (instructions?.records ?? []).filter((record) => record.type && record.name && record.value),
    notes: instructions?.notes ?? [],
  };
}

function EmailDnsInstructionCallout({ identity }: { identity: TenantEmailIdentity }) {
  const isVerified =
    identity.providerStatus === "verified" && identity.verificationStatus === "verified";

  return (
    <div
      className={joinClasses(
        "rounded-[8px] border px-4 py-3 text-sm leading-6",
        isVerified
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-amber-200 bg-amber-50 text-amber-800",
      )}
    >
      <div className="flex items-start gap-2">
        {isVerified ? (
          <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
        ) : (
          <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
        )}
        <p>
          {isVerified
            ? "These DNS records are active and approved by Amazon SES."
            : "Add these CNAME records in the domain's DNS provider, then click Check SES to confirm Amazon has approved the sender."}
        </p>
      </div>
    </div>
  );
}

function EmailDnsInstructions({ identity }: { identity: TenantEmailIdentity }) {
  const { records } = getEmailDnsInstructionRecords(identity);
  const isVerified =
    identity.providerStatus === "verified" && identity.verificationStatus === "verified";
  const needsAttention = !isVerified || Boolean(identity.lastError);

  if (records.length === 0 && !identity.lastError) {
    return null;
  }

  return (
    <details className="group rounded-[8px] border border-slate-200 bg-white" open={needsAttention}>
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-slate-900">
        <span className="inline-flex items-center gap-2">
          <ChevronDownIcon className="h-4 w-4 text-slate-500 transition-transform group-open:rotate-180" />
          Amazon SES DNS records
        </span>
        <span
          className={joinClasses(
            "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
            needsAttention
              ? "bg-amber-50 text-amber-700 ring-amber-200"
              : "bg-emerald-50 text-emerald-700 ring-emerald-200",
          )}
        >
          {needsAttention ? "Needs attention" : "Ready"}
        </span>
      </summary>
      <div className="grid gap-3 border-t border-slate-100 p-4">
        {identity.lastError ? (
          <Alert tone="error">{identity.lastError}</Alert>
        ) : null}
        {records.length ? <EmailDnsInstructionCallout identity={identity} /> : null}
        {records.length ? (
          <div className="overflow-hidden rounded-[8px] border border-slate-200">
            <div className="grid grid-cols-[88px_minmax(0,1fr)_minmax(0,1.3fr)] gap-0 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <div>Type</div>
              <div>Name</div>
              <div>Value</div>
            </div>
            <div className="divide-y divide-slate-100">
              {records.map((record, index) => (
                <div
                  key={`${record.type}-${record.name}-${index}`}
                  className="grid grid-cols-[88px_minmax(0,1fr)_minmax(0,1.3fr)] gap-3 px-3 py-3 text-xs"
                >
                  <div className="font-mono font-semibold text-slate-900">{record.type}</div>
                  <input
                    readOnly
                    value={record.name}
                    className="min-w-0 rounded-[8px] border border-slate-200 bg-white px-2 py-1 font-mono text-slate-800"
                    aria-label={`${identity.senderDomain} email DNS record name`}
                  />
                  <input
                    readOnly
                    value={record.value}
                    className="min-w-0 rounded-[8px] border border-slate-200 bg-white px-2 py-1 font-mono text-slate-800"
                    aria-label={`${identity.senderDomain} email DNS record value`}
                  />
                  {record.reason ? (
                    <div className="col-span-3 text-slate-500">{record.reason}</div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </details>
  );
}

type EffectiveEmailSendingStatus = "tenant_verified" | "rybs_managed" | "unable";

function getEffectiveEmailSendingStatus(input: {
  emailIdentity: TenantEmailIdentity | null;
  awsConfigured: boolean;
  rybsSenderConfigured: boolean;
}): EffectiveEmailSendingStatus {
  if (!input.awsConfigured) return "unable";

  if (
    input.emailIdentity?.provider === "ses" &&
    input.emailIdentity.providerStatus === "verified" &&
    input.emailIdentity.verificationStatus === "verified"
  ) {
    return "tenant_verified";
  }

  return input.rybsSenderConfigured ? "rybs_managed" : "unable";
}

function EmailIdentityReadiness({
  emailIdentity,
  effectiveStatus,
  rybsManagedSender,
}: {
  emailIdentity: TenantEmailIdentity | null;
  effectiveStatus: EffectiveEmailSendingStatus;
  rybsManagedSender: ReturnType<typeof getRybManagedEmailSenderConfig>;
}) {
  if (effectiveStatus === "tenant_verified") {
    return null;
  }

  if (effectiveStatus === "rybs_managed") {
    return (
      <Alert tone="warning">
        Customer emails use the RYBS managed sender
        {rybsManagedSender.senderEmail ? ` (${rybsManagedSender.senderEmail})` : ""} with this tenant&apos;s display name and Reply-To.
      </Alert>
    );
  }

  if (!emailIdentity) {
    return (
      <Alert tone="error">
        Unable to send customer emails. Configure RYBS_MANAGED_SES_FROM_EMAIL or verify a tenant sender identity.
      </Alert>
    );
  }

  if (emailIdentity.verificationStatus === "dns_required") {
    return (
      <Alert tone="error">
        Unable to send customer emails. SES returned DKIM records for the tenant sender, but no RYBS managed sender is configured.
      </Alert>
    );
  }

  if (emailIdentity.verificationStatus === "failed") {
    return (
      <Alert tone="error">
        SES could not verify this identity. Review the provider error and DNS records before retrying.
      </Alert>
    );
  }

  return (
    <Alert tone="error">
      Unable to send customer emails. This sender identity is saved but not verified, and no RYBS managed sender is configured.
    </Alert>
  );
}

function EmailSendingSection({
  tenant,
  emailIdentity,
  checkedEmailIdentity,
}: {
  tenant: PlatformTenantSummary;
  emailIdentity: TenantEmailIdentity | null;
  checkedEmailIdentity?: string;
}) {
  const integration = getPlatformEmailIdentityIntegrationStatus();
  const rybsManagedSender = getRybManagedEmailSenderConfig();
  const effectiveStatus = getEffectiveEmailSendingStatus({
    emailIdentity,
    awsConfigured: integration.configured,
    rybsSenderConfigured: rybsManagedSender.configured,
  });
  const canDisable = emailIdentity && emailIdentity.providerStatus !== "disabled";
  const effectiveStatusLabel =
    effectiveStatus === "tenant_verified"
      ? "Using verified tenant sender"
      : effectiveStatus === "rybs_managed"
        ? "Using RYBS managed sender"
        : "Unable to send";
  const effectiveStatusClasses =
    effectiveStatus === "tenant_verified"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : effectiveStatus === "rybs_managed"
        ? "bg-sky-50 text-sky-700 ring-sky-200"
        : "bg-rose-50 text-rose-700 ring-rose-200";
  const rybsManagedSenderNeedsAttention =
    effectiveStatus !== "tenant_verified" && !rybsManagedSender.configured;
  const platformEmailSetupNeedsAttention = !integration.configured || rybsManagedSenderNeedsAttention;
  const businessSenderNeedsAttention = Boolean(emailIdentity && emailIdentity.providerStatus !== "verified");
  const emailIdentityActionRequired = emailIdentity
    ? getEmailIdentityActionRequired(emailIdentity.providerStatus)
    : null;
  const editSenderIdentityNeedsAttention = !emailIdentity;

  return (
    <section id="email-sending" className="scroll-mt-6 rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-slate-900">Email sending</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Shows what email address customers see when this business sends email.
          </p>
        </div>
        <span
          className={joinClasses(
            "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
            effectiveStatusClasses,
          )}
        >
          {effectiveStatusLabel}
        </span>
      </div>

      <div className="mt-4 grid gap-3">
        <EmailIdentityReadiness
          emailIdentity={emailIdentity}
          effectiveStatus={effectiveStatus}
          rybsManagedSender={rybsManagedSender}
        />
        {!integration.configured ? (
          <Alert tone="warning">
            SES identity provisioning needs AWS_REGION or SES_REGION, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY.
          </Alert>
        ) : null}
        {rybsManagedSenderNeedsAttention ? (
          <Alert tone="warning">
            The shared backup email sender is not configured. Businesses without their own verified sender may not be able to send customer emails.
          </Alert>
        ) : null}
      </div>

      <details
        className="group mt-4 rounded-[8px] border border-slate-200 bg-white"
        open={platformEmailSetupNeedsAttention}
      >
        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-slate-900">
          <span className="inline-flex items-center gap-2">
            <ChevronDownIcon className="h-4 w-4 text-slate-500 transition-transform group-open:rotate-180" />
            Platform email setup
          </span>
          <span
            className={joinClasses(
              "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
              platformEmailSetupNeedsAttention
                ? "bg-amber-50 text-amber-700 ring-amber-200"
                : "bg-emerald-50 text-emerald-700 ring-emerald-200",
            )}
          >
            {platformEmailSetupNeedsAttention ? "Needs attention" : "Completed"}
          </span>
        </summary>
        <dl className="grid border-t border-slate-100 text-sm sm:grid-cols-4 sm:divide-x sm:divide-slate-200">
          <div className="border-b border-slate-100 p-4 sm:border-b-0">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Region</dt>
            <dd className="mt-1 text-slate-900">{integration.regionConfigured ? "Set" : "Missing"}</dd>
          </div>
          <div className="border-b border-slate-100 p-4 sm:border-b-0">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Access key</dt>
            <dd className="mt-1 text-slate-900">{integration.accessKeyConfigured ? "Set" : "Missing"}</dd>
          </div>
          <div className="border-b border-slate-100 p-4 sm:border-b-0">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Secret key</dt>
            <dd className="mt-1 text-slate-900">{integration.secretKeyConfigured ? "Set" : "Missing"}</dd>
          </div>
          <div className="p-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">RYBS sender</dt>
            <dd className="mt-1 break-all text-slate-900">{rybsManagedSender.senderEmail ?? "Missing"}</dd>
          </div>
        </dl>
      </details>

      {emailIdentity ? (
        <details
          className="group mt-4 rounded-[8px] border border-slate-200 bg-white"
          open={businessSenderNeedsAttention}
        >
          <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-slate-900">
            <span className="inline-flex min-w-0 items-center gap-2">
              <ChevronDownIcon className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-open:rotate-180" />
              <span className="break-all">{emailIdentity.fromEmail}</span>
            </span>
            <EmailIdentityStatusBadge status={emailIdentity.providerStatus} />
          </summary>
          <div className="grid gap-3 border-t border-slate-100 p-4">
            <div className="grid items-stretch gap-3 lg:grid-cols-[minmax(0,1fr)_20rem]">
              <div className="flex min-w-0 rounded-[8px] border border-slate-200 bg-slate-50 p-4 text-sm">
                <dl className="grid gap-2 text-slate-700">
                  <div className="grid gap-1 sm:grid-cols-[112px_minmax(0,1fr)]">
                    <dt className="font-semibold text-slate-900">Email:</dt>
                    <dd className="break-all font-mono text-slate-900">{emailIdentity.fromEmail}</dd>
                  </div>
                  <div className="grid gap-1 sm:grid-cols-[112px_minmax(0,1fr)]">
                    <dt className="font-semibold text-slate-900">Display name:</dt>
                    <dd>{emailIdentity.senderDisplayName ?? "Not set"}</dd>
                  </div>
                  <div className="grid gap-1 sm:grid-cols-[112px_minmax(0,1fr)]">
                    <dt className="font-semibold text-slate-900">Reply-To:</dt>
                    <dd className="break-all">{emailIdentity.replyToEmail ?? "Not set"}</dd>
                  </div>
                  <div className="grid gap-1 sm:grid-cols-[112px_minmax(0,1fr)]">
                    <dt className="font-semibold text-slate-900">Last checked:</dt>
                    <dd>{formatDateTime(emailIdentity.lastCheckedAt)}</dd>
                  </div>
                  {emailIdentityActionRequired ? (
                    <div className="grid gap-1 sm:grid-cols-[112px_minmax(0,1fr)]">
                      <dt className="font-semibold text-amber-700">{emailIdentityActionRequired.label}:</dt>
                      <dd className="text-amber-700">{emailIdentityActionRequired.message}</dd>
                    </div>
                  ) : null}
                </dl>
              </div>
              <div className="flex w-full flex-col items-stretch justify-between gap-2">
                <form action={checkEmailIdentityAction} className="w-full">
                  <input type="hidden" name="tenantId" value={tenant.id} />
                  <button
                    type="submit"
                    className="admin-btn h-11 w-full justify-start !border-sky-300 !bg-sky-50 !text-sky-700 hover:!border-sky-400 hover:!bg-sky-100 hover:!text-sky-800"
                    disabled={!integration.configured}
                  >
                    <CheckCircleIcon className="h-4 w-4" />
                    Check SES
                  </button>
                </form>
                <form action={sendTestEmailAction} className="w-full">
                  <input type="hidden" name="tenantId" value={tenant.id} />
                  <button
                    type="submit"
                    className="admin-btn h-11 w-full justify-start !border-amber-300 !bg-amber-50 !text-amber-700 hover:!border-amber-400 hover:!bg-amber-100 hover:!text-amber-800"
                    disabled={!emailIdentity.replyToEmail}
                  >
                    <EnvelopeIcon className="h-4 w-4" />
                    Send test email
                  </button>
                </form>
                {canDisable ? (
                  <form action={disableEmailIdentityAction} className="w-full">
                    <input type="hidden" name="tenantId" value={tenant.id} />
                    <button
                      type="submit"
                      className="admin-btn h-11 w-full justify-start !border-rose-300 !bg-rose-50 !text-rose-700 hover:!border-rose-400 hover:!bg-rose-100 hover:!text-rose-800"
                    >
                      <PauseCircleIcon className="h-4 w-4" />
                      Disable
                    </button>
                  </form>
                ) : null}
              </div>
            </div>

            {checkedEmailIdentity ? (
              <Alert tone="success">SES email identity verification was re-checked.</Alert>
            ) : null}

            <EmailDnsInstructions identity={emailIdentity} />

            <form action={removeEmailIdentityAction} className="grid gap-3 border-t border-slate-100 pt-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <input type="hidden" name="tenantId" value={tenant.id} />
              <div>
                <label htmlFor="remove-email-identity" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Remove business email sender
                </label>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  This will cause Demo Dumpster Company to stop sending customers emails from{" "}
                  <span className="font-mono text-slate-900">{emailIdentity.fromEmail}</span>.
                </p>
                <input
                  id="remove-email-identity"
                  name="confirmation"
                  type="text"
                  placeholder={`Enter ${emailIdentity.senderDomain} to remove`}
                  className="mt-2 block h-10 w-full rounded-[8px] border border-slate-300 px-3 font-mono text-xs text-slate-900 shadow-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
                />
              </div>
              <button
                type="submit"
                className="admin-btn h-10 !border-red-600 !bg-red-600 px-5 !text-white shadow-sm hover:!border-red-700 hover:!bg-red-700 hover:!text-white"
              >
                <TrashIcon className="h-4 w-4" />
                Remove sender
              </button>
            </form>
          </div>
        </details>
      ) : null}

      <details
        className="group mt-4 rounded-[8px] border border-slate-200 bg-white"
        open={editSenderIdentityNeedsAttention}
      >
        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-slate-900">
          <span className="inline-flex items-center gap-2">
            <ChevronDownIcon className="h-4 w-4 text-slate-500 transition-transform group-open:rotate-180" />
            Edit sender identity
          </span>
          {editSenderIdentityNeedsAttention ? (
            <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
              Needs setup
            </span>
          ) : null}
        </summary>
        <form action={saveEmailIdentityAction} className="grid gap-4 border-t border-slate-100 p-4">
          <input type="hidden" name="tenantId" value={tenant.id} />
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="senderDomain" className="text-sm font-semibold text-slate-700">
                Sender domain
              </label>
              <input
                id="senderDomain"
                name="senderDomain"
                type="text"
                defaultValue={emailIdentity?.senderDomain ?? ""}
                placeholder="demodumpstercompany.com"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="mt-2 block h-11 w-full rounded-[8px] border border-slate-300 px-3 font-mono text-sm text-slate-900 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                required
              />
            </div>
            <div>
              <label htmlFor="senderLocalPart" className="text-sm font-semibold text-slate-700">
                Sender local part
              </label>
              <input
                id="senderLocalPart"
                name="senderLocalPart"
                type="text"
                defaultValue={emailIdentity?.senderLocalPart ?? "bookings"}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="mt-2 block h-11 w-full rounded-[8px] border border-slate-300 px-3 font-mono text-sm text-slate-900 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                required
              />
            </div>
            <div>
              <label htmlFor="senderDisplayName" className="text-sm font-semibold text-slate-700">
                Display name
              </label>
              <input
                id="senderDisplayName"
                name="senderDisplayName"
                type="text"
                defaultValue={emailIdentity?.senderDisplayName ?? tenant.displayName}
                className="mt-2 block h-11 w-full rounded-[8px] border border-slate-300 px-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />
            </div>
            <div>
              <label htmlFor="replyToEmail" className="text-sm font-semibold text-slate-700">
                Reply-To on sender domain
              </label>
              <input
                id="replyToEmail"
                name="replyToEmail"
                type="email"
                defaultValue={emailIdentity?.replyToEmail ?? ""}
                autoComplete="email"
                className="mt-2 block h-11 w-full rounded-[8px] border border-slate-300 px-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-slate-600">
              Derived From address:{" "}
              <span className="font-mono font-semibold text-slate-900">
                {emailIdentity?.fromEmail ?? "sender-local-part@sender-domain"}
              </span>
            </div>
            <FormSubmitButton loadingLabel="Saving...">Save sender identity</FormSubmitButton>
          </div>
        </form>
      </details>
    </section>
  );
}

function paymentModeLabel(mode: PlatformTenantPaymentMode) {
  return mode === "production"
    ? "Live"
    : mode.charAt(0).toUpperCase() + mode.slice(1);
}

function PaymentModeBadge({ mode }: { mode: PlatformTenantPaymentMode }) {
  const className = mode === "production"
    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : mode === "sandbox"
      ? "bg-amber-50 text-amber-700 ring-amber-200"
      : "bg-slate-100 text-slate-600 ring-slate-200";

  return (
    <span className={joinClasses("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset", className)}>
      {paymentModeLabel(mode)}
    </span>
  );
}

function latestConnection(
  connections: PlatformTenantPaymentConnectionSummary[],
  environment: "sandbox" | "production",
) {
  return connections
    .filter((connection) => connection.environment === environment)
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))[0] ?? null;
}

function PaymentsSection({
  tenantId,
  setting,
  connections,
}: {
  tenantId: string;
  setting: PlatformTenantPaymentSetting;
  connections: PlatformTenantPaymentConnectionSummary[];
}) {
  const sandboxConnection = latestConnection(connections, "sandbox");
  const productionConnection = latestConnection(connections, "production");
  const sandboxReady = sandboxConnection?.status === "active" && Boolean(sandboxConnection.locationId);
  const liveReady = productionConnection?.status === "active" && Boolean(productionConnection.locationId);
  const selectedModeNeedsAttention =
    (setting.mode === "sandbox" && !sandboxReady) ||
    (setting.mode === "production" && !liveReady);
  const paymentModeRows: Array<{
    value: PlatformTenantPaymentMode;
    label: string;
    description: string;
    connection?: PlatformTenantPaymentConnectionSummary | null;
    ready: boolean | null | undefined;
  }> = [
    {
      value: "disabled" as const,
      label: "Disabled",
      description: "No Square environment is approved.",
      connection: null,
      ready: null,
    },
    {
      value: "sandbox" as const,
      label: "Sandbox",
      description: "Use Square test data without creating real charges.",
      connection: sandboxConnection,
      ready: sandboxReady,
    },
    {
      value: "production" as const,
      label: "Production",
      description: "Allow real charges through Square.",
      connection: productionConnection,
      ready: liveReady,
    },
  ];

  return (
    <section id="payments" className="scroll-mt-6 rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-slate-100 text-slate-600">
            <CreditCardIcon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold tracking-tight text-slate-900">Payments</h2>
          </div>
        </div>
        <PaymentModeBadge mode={setting.mode} />
      </div>

      <details
        className="group mt-4 rounded-[8px] border border-slate-200 bg-white"
        open={selectedModeNeedsAttention}
      >
        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-slate-900">
          <span className="inline-flex items-center gap-2">
            <ChevronDownIcon className="h-4 w-4 text-slate-500 transition-transform group-open:rotate-180" />
            Change payment mode
          </span>
          {selectedModeNeedsAttention ? (
            <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
              Needs attention
            </span>
          ) : null}
        </summary>
        <form action={updatePaymentModeAction} className="space-y-4 border-t border-slate-100 p-4">
          <input type="hidden" name="tenantId" value={tenantId} />

          {setting.mode === "production" && !liveReady ? (
            <Alert tone="error">
              Production is selected, but this business does not have an active production Square connection with a location.
            </Alert>
          ) : null}

          <fieldset>
            <legend className="sr-only">Payment mode</legend>
            <div className="grid gap-3 rounded-[10px] border border-slate-200 bg-slate-50 p-3">
              {paymentModeRows.map((option) => {
                const productionUnavailable = option.value === "production" && !liveReady;
                const disabled = productionUnavailable && setting.mode !== "production";
                const selected = setting.mode === option.value;
                const statusLabel = option.ready === null
                  ? null
                  : option.ready
                    ? "Ready"
                    : "Not ready";

                return (
                  <label
                    key={option.value}
                    className={joinClasses(
                      "grid gap-3 rounded-[8px] border p-4 shadow-sm transition sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center",
                      selected
                        ? "border-sky-300 bg-sky-50 ring-1 ring-sky-200"
                        : disabled
                          ? "border-slate-200 bg-slate-100 text-slate-400 shadow-none"
                          : "cursor-pointer border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
                    )}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">{option.label}</span>
                        {statusLabel ? (
                          <span
                            className={joinClasses(
                              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
                              option.ready
                                ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                                : "bg-slate-100 text-slate-600 ring-slate-200",
                            )}
                          >
                            {option.ready ? (
                              <CheckCircleIcon className="h-3.5 w-3.5" />
                            ) : (
                              <ExclamationTriangleIcon className="h-3.5 w-3.5" />
                            )}
                            {statusLabel}
                          </span>
                        ) : null}
                      </div>
                      {option.connection ? (
                        <p className="mt-2 font-mono text-xs text-slate-500">
                          Merchant ID: {option.connection.merchantId ?? "Not recorded"}
                        </p>
                      ) : option.value === "production" ? (
                        <p className="mt-2 text-xs text-slate-500">Merchant ID: —</p>
                      ) : null}
                      <p className="mt-2 text-sm leading-6 text-slate-600">{option.description}</p>
                    </div>
                    <input
                      className="h-5 w-5 justify-self-start border-slate-300 text-sky-600 focus:ring-sky-500 sm:justify-self-end"
                      type="radio"
                      name="paymentMode"
                      value={option.value}
                      defaultChecked={setting.mode === option.value}
                      disabled={disabled}
                    />
                  </label>
                );
              })}
            </div>
          </fieldset>

          {liveReady ? (
            <div className="max-w-xl">
              <label htmlFor="liveConfirmation" className="text-sm font-semibold text-slate-700">
                Production confirmation
              </label>
              <input
                id="liveConfirmation"
                name="liveConfirmation"
                type="text"
                autoComplete="off"
                className="mt-2 block h-11 w-full rounded-[8px] border border-slate-300 px-3 font-mono text-sm text-slate-900 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                placeholder="Type LIVE only when activating real payments"
              />
            </div>
          ) : (
            <p className="text-xs leading-5 text-slate-500">
              Production remains unavailable until the business connects an active production Square account and selects a location.
            </p>
          )}

          <FormSubmitButton loadingLabel="Saving payment mode...">
            Save payment mode
          </FormSubmitButton>
        </form>
      </details>
    </section>
  );
}

function BusinessAdminAccessSection({ tenant }: { tenant: PlatformTenantSummary }) {
  return (
    <section id="business-admin-access" className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-slate-900">Business admin access</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Give an existing user admin access to this business.
          </p>
        </div>
        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
          {tenant.signals.activeAdminMembershipCount} active
        </span>
      </div>

      <details className="group mt-4 rounded-[8px] border border-slate-200 bg-white">
        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-slate-900">
          <span className="inline-flex items-center gap-2">
            <ChevronDownIcon className="h-4 w-4 text-slate-500 transition-transform group-open:rotate-180" />
            Add business admin
          </span>
        </summary>
        <form action={assignBusinessAdminAction} className="flex flex-col gap-3 border-t border-slate-100 p-4 sm:flex-row sm:items-end">
          <input type="hidden" name="tenantId" value={tenant.id} />
          <div className="w-full sm:w-1/2">
            <label htmlFor="admin-email" className="text-sm font-semibold text-slate-700">
              Existing auth user email
            </label>
            <input
              id="admin-email"
              name="email"
              type="email"
              autoComplete="email"
              className="mt-2 block h-11 w-full rounded-[8px] border border-slate-300 px-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              required
            />
          </div>
          <FormSubmitButton className="admin-btn admin-btn-primary h-11 min-w-[9rem] px-5" loadingLabel="Assigning...">
            Add admin
          </FormSubmitButton>
        </form>
      </details>
    </section>
  );
}

function LifecycleSection({
  tenant,
  isCurrentSiteTenant,
}: {
  tenant: PlatformTenantSummary;
  isCurrentSiteTenant: boolean;
}) {
  const active = tenant.status === "active";
  const setupIncomplete = tenant.setup.status === "needs_attention";

  return (
    <section className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-slate-900">Business status</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Controls whether this business is active.
          </p>
        </div>
        <TenantStatusBadge tenant={tenant} />
      </div>

      <details className="group mt-4 rounded-[8px] border border-slate-200 bg-white">
        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-slate-900">
          <span className="inline-flex items-center gap-2">
            <ChevronDownIcon className="h-4 w-4 text-slate-500 transition-transform group-open:rotate-180" />
            {active ? "Deactivate business" : "Activate business"}
          </span>
        </summary>
        {active ? (
          <form action={deactivateBusinessAction} className="space-y-4 border-t border-slate-100 p-4">
            <input type="hidden" name="tenantId" value={tenant.id} />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="w-full sm:w-1/2">
                <label htmlFor="confirmationSlug" className="sr-only">
                  Enter the URL name to deactivate
                </label>
                <input
                  id="confirmationSlug"
                  name="confirmationSlug"
                  type="text"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="block h-11 w-full rounded-[8px] border border-slate-300 px-3 font-mono text-sm text-slate-900 shadow-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
                  placeholder="Enter the URL name to deactivate"
                  required
                />
              </div>
              <FormSubmitButton
                className="admin-btn h-11 min-w-[9rem] !border-red-600 !bg-red-600 px-5 !text-white shadow-sm hover:!border-red-700 hover:!bg-red-700 hover:!text-white"
                loadingLabel="Deactivating..."
              >
                Deactivate
              </FormSubmitButton>
            </div>
            {isCurrentSiteTenant ? (
              <div>
                <label htmlFor="currentSiteConfirmation" className="text-sm font-semibold text-slate-700">
                  Current-site confirmation
                </label>
                <input
                  id="currentSiteConfirmation"
                  name="currentSiteConfirmation"
                  type="text"
                  className="mt-2 block h-11 w-full rounded-[8px] border border-slate-300 px-3 font-mono text-sm text-slate-900 shadow-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
                  placeholder={CURRENT_SITE_DEACTIVATION_CONFIRMATION}
                  required
                />
                <p className="mt-2 text-xs text-slate-500">
                  This extra confirmation is required because this URL name is the configured local tenant.
                </p>
              </div>
            ) : null}
            <p className="flex items-start gap-2 text-xs leading-5 text-slate-500">
              <InformationCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <span>
                Deactivating this business will make it inactive, but it will not delete settings,
                content, users, bookings, customers, or records.
              </span>
            </p>
          </form>
        ) : (
          <form action={activateBusinessAction} className="space-y-4 border-t border-slate-100 p-4">
            <input type="hidden" name="tenantId" value={tenant.id} />
            {setupIncomplete ? (
              <Alert tone="warning">
                This business still needs required setup. Activation is allowed only with explicit confirmation.
              </Alert>
            ) : null}
            {setupIncomplete ? (
              <label className="flex items-start gap-3 rounded-[8px] border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-800">
                <input
                  name="acknowledgeIncompleteSetup"
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-red-300 text-red-600 focus:ring-red-500"
                  required
                />
                <span>
                  I understand this business is missing required setup and want to activate it anyway.
                </span>
              </label>
            ) : null}
            <FormSubmitButton loadingLabel="Activating...">
              <PlayCircleIcon className="h-4 w-4" />
              Activate business
            </FormSubmitButton>
          </form>
        )}
      </details>
    </section>
  );
}

export default async function PlatformBusinessDetailPage({ params, searchParams }: PageProps) {
  const { tenantId } = await params;
  const search = searchParams ? await searchParams : {};
  const detail = await getPlatformTenantDetail(tenantId);

  if (!detail) {
    notFound();
  }

  const { tenant, domains, emailIdentity } = detail;
  const [paymentSetting, paymentConnections] = await Promise.all([
    getPlatformTenantPaymentSetting(tenant.id, "square"),
    listPlatformTenantPaymentConnections(tenant.id, "square"),
  ]);
  const message = pageStatusMessage(search.status, search.error);
  const configuredLocalTenantSlug = getConfiguredLocalTenantSlug();
  const isCurrentSiteTenant = tenant.slug === configuredLocalTenantSlug;

  return (
    <AdminPage width="wide" className="space-y-6 pt-2">
      <div className="space-y-3">
        <Link
          href="/platform-admin/businesses"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Businesses
        </Link>

        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              {tenant.displayName}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            <TenantStatusBadge tenant={tenant} />
            <Link
              href={`/platform-admin/businesses/${tenant.id}/edit`}
              className="admin-btn admin-btn-secondary"
            >
              <PencilSquareIcon className="h-4 w-4" />
              Edit business
            </Link>
            <Link
              href={`/platform-admin/businesses/${tenant.id}/audit`}
              className="admin-btn admin-btn-secondary"
            >
              <ClipboardDocumentListIcon className="h-4 w-4" />
              View audit log
            </Link>
          </div>
        </div>
      </div>

      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}

      {tenant.status !== "active" ? (
        <Alert tone="warning">
          This business is inactive and cannot be resolved as an active tenant.
        </Alert>
      ) : tenant.setup.status === "needs_attention" ? (
        <Alert tone="warning">
          This business is active but setup still needs attention. Review the incomplete areas before routing traffic here.
        </Alert>
      ) : null}

      <LaunchReadinessSection tenant={tenant} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold tracking-tight text-slate-900">Basic tenant information</h2>
          <dl className="mt-4 space-y-4">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tenant UUID</dt>
              <dd className="mt-1 break-all text-sm text-slate-900">{tenant.id}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">URL name</dt>
              <dd className="mt-1 text-sm text-slate-900">{tenant.slug}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Created</dt>
              <dd className="mt-1 text-sm text-slate-900">{formatDateTime(tenant.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Updated</dt>
              <dd className="mt-1 text-sm text-slate-900">{formatDateTime(tenant.updatedAt)}</dd>
            </div>
          </dl>

          {/* Tenant-specific /admin entry is intentionally omitted until business admin uses strict tenant resolution. */}
        </section>

        <ImplementationTypeSection tenant={tenant} />
      </div>

      <LifecycleSection tenant={tenant} isCurrentSiteTenant={isCurrentSiteTenant} />

      <BusinessAdminAccessSection tenant={tenant} />

      <PaymentsSection
        tenantId={tenant.id}
        setting={paymentSetting}
        connections={paymentConnections}
      />

      <DomainIntegrationStatusSection domains={domains} />

      <EmailSendingSection
        tenant={tenant}
        emailIdentity={emailIdentity}
        checkedEmailIdentity={search.checkedEmailIdentity}
      />

      <TenantDomainsSection
        tenant={tenant}
        domains={domains}
        checkedDomainId={search.checkedDomainId}
      />

      <section id="setup-checklist" className="scroll-mt-6">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">Setup checklist</h2>
            <p className="mt-1 text-sm text-slate-600">
              Checks are derived from existing tenant, settings, pricing, service area, inventory, product, content, and domain rows.
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {tenant.setup.areas.map((area) => (
            <SetupAreaCard key={area.key} tenant={tenant} area={area} />
          ))}
        </div>
      </section>
    </AdminPage>
  );
}
