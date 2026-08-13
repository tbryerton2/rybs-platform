import {
  ArrowLeftIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  PauseCircleIcon,
  PencilSquareIcon,
  PlayCircleIcon,
  PlusIcon,
  StarIcon,
  TrashIcon,
  UserPlusIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FormSubmitButton } from "@/app/admin/_components/admin/form-submit-button";
import { AdminPage, AdminPageHeader } from "@/app/admin/_components/admin/admin-page";
import {
  activateBusinessAction,
  activateDomainAction,
  assignBusinessAdminAction,
  checkDomainAction,
  deactivateBusinessAction,
  disableDomainAction,
  makePrimaryDomainAction,
  provisionDomainAction,
  removeDomainAction,
  updateImplementationTypeAction,
} from "@/app/platform-admin/(protected)/businesses/actions";
import { getPlatformDomainIntegrationStatus } from "@/lib/platform-admin/domains";
import { CURRENT_SITE_DEACTIVATION_CONFIRMATION } from "@/lib/platform-admin/tenant-validation";
import { getPlatformTenantDetail, type PlatformTenantDomain } from "@/lib/platform-admin/tenants";
import type {
  PlatformTenantSummary,
  SetupAreaKey,
  SetupAreaStatus,
  TenantImplementationType,
} from "@/lib/platform-admin/setup-completeness";
import { getConfiguredCurrentTenantSlug } from "@/lib/tenant/resolution";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{ tenantId: string }>;
  searchParams?: Promise<{ status?: string; error?: string; checkedDomainId?: string }>;
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

function launchReadinessSuccessMessage(
  status: PlatformTenantSummary["setup"]["readinessStatus"],
) {
  switch (status) {
    case "ready_to_launch":
      return "Required setup is complete. This business is ready to launch.";
    case "active":
      return "Required setup is complete and this business is active.";
    case "not_started":
    case "in_progress":
    case "active_setup_incomplete":
      return null;
  }
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
    case "implementation-updated":
      return { tone: "success" as const, text: "Implementation type was updated." };
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
  if (domain.status === "active") return "Active";
  if (domain.status === "disabled") return "Disabled";

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
      return "Ready to activate";
    case "error":
      return "Provider error";
    default:
      return "Pending setup";
  }
}

function ProviderStatusBadge({ domain }: { domain: PlatformTenantDomain }) {
  const label = providerStatusLabel(domain);
  const className =
    domain.status === "active" || domain.providerStatus === "ready"
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

  if (records.length === 0 && notes.length === 0 && !domain.lastError) {
    return null;
  }

  return (
    <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4">
      {domain.lastError ? (
        <Alert tone="error">{domain.lastError}</Alert>
      ) : null}
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
                  aria-label={`${domain.hostname} DNS record name`}
                />
                <input
                  readOnly
                  value={record.value}
                  className="min-w-0 rounded-[8px] border border-slate-200 bg-white px-2 py-1 font-mono text-slate-800"
                  aria-label={`${domain.hostname} DNS record value`}
                />
                {record.reason ? (
                  <div className="col-span-3 text-slate-500">{record.reason}</div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {notes.length ? (
        <div className="grid gap-1 text-xs leading-5 text-slate-600">
          {notes.map((note) => (
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
  const hasPendingCustomDomain = domains.some(
    (domain) => domain.domainType === "custom_domain" && domain.status === "pending",
  );
  const hasInactivePrimary = domains.some(
    (domain) => domain.isPrimary && domain.status !== "active",
  );

  return (
    <section id="public-domains" className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Public domains</h2>
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
      </div>

      {domains.length ? (
        <div className="mt-4 grid gap-3">
          {domains.map((domain) => {
            const isOnlyActiveDomain = domain.status === "active" && activeDomains.length <= 1;

            return (
              <article
                key={domain.id}
                id={`domain-${domain.id}`}
                className="scroll-mt-6 rounded-[8px] border border-slate-200 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="break-all font-mono text-sm font-semibold text-slate-900">
                      {domain.hostname}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                      <span>{formatDomainType(domain.domainType)}</span>
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
                      <span>Created {formatDateTime(domain.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Link
                      href={`/platform-admin/businesses/${tenant.id}/domains/${domain.id}`}
                      className="admin-btn admin-btn-secondary"
                    >
                      <PencilSquareIcon className="h-4 w-4" />
                      Edit
                    </Link>
                    {domain.providerStatus === "not_provisioned" || domain.providerStatus === "error" ? (
                      <form action={provisionDomainAction}>
                        <input type="hidden" name="tenantId" value={tenant.id} />
                        <input type="hidden" name="domainId" value={domain.id} />
                        <button type="submit" className="admin-btn admin-btn-secondary">
                          <PlayCircleIcon className="h-4 w-4" />
                          Provision on Vercel
                        </button>
                      </form>
                    ) : null}
                    {domain.providerStatus !== "not_provisioned" ? (
                      <form action={checkDomainAction}>
                        <input type="hidden" name="tenantId" value={tenant.id} />
                        <input type="hidden" name="domainId" value={domain.id} />
                        <button type="submit" className="admin-btn admin-btn-secondary">
                          <CheckCircleIcon className="h-4 w-4" />
                          Check domain
                        </button>
                      </form>
                    ) : null}
                    {domainCanActivate(domain) ? (
                      <form action={activateDomainAction}>
                        <input type="hidden" name="tenantId" value={tenant.id} />
                        <input type="hidden" name="domainId" value={domain.id} />
                        <button type="submit" className="admin-btn admin-btn-secondary">
                          <PlayCircleIcon className="h-4 w-4" />
                          Activate
                        </button>
                      </form>
                    ) : null}
                    {domain.status !== "disabled" ? (
                      <form action={disableDomainAction}>
                        <input type="hidden" name="tenantId" value={tenant.id} />
                        <input type="hidden" name="domainId" value={domain.id} />
                        <button type="submit" className="admin-btn admin-btn-secondary">
                          <PauseCircleIcon className="h-4 w-4" />
                          Disable
                        </button>
                      </form>
                    ) : null}
                    {domain.status === "active" && !domain.isPrimary ? (
                      <form action={makePrimaryDomainAction}>
                        <input type="hidden" name="tenantId" value={tenant.id} />
                        <input type="hidden" name="domainId" value={domain.id} />
                        <button type="submit" className="admin-btn admin-btn-secondary">
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

                <form action={removeDomainAction} className="mt-4 grid gap-3 border-t border-slate-100 pt-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                  <input type="hidden" name="tenantId" value={tenant.id} />
                  <input type="hidden" name="domainId" value={domain.id} />
                  <div>
                    <label htmlFor={`remove-${domain.id}`} className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Remove confirmation
                    </label>
                    <input
                      id={`remove-${domain.id}`}
                      name="confirmation"
                      type="text"
                      placeholder={domain.hostname}
                      className="mt-1 block h-10 w-full rounded-[8px] border border-slate-300 px-3 font-mono text-xs text-slate-900 shadow-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
                    />
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-600">
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
                  </div>
                  <button type="submit" className="admin-btn admin-btn-destructive">
                    <TrashIcon className="h-4 w-4" />
                    Remove
                  </button>
                </form>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 rounded-[8px] border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-600">
          No public domain mappings have been added for this business.
        </div>
      )}
    </section>
  );
}

function LaunchReadinessSection({ tenant }: { tenant: PlatformTenantSummary }) {
  const missingAreas = tenant.setup.missingRequiredAreas;
  const successMessage = launchReadinessSuccessMessage(tenant.setup.readinessStatus);

  return (
    <section className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Launch readiness</h2>
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
        ) : successMessage ? (
          <Alert tone="success">{successMessage}</Alert>
        ) : null}
      </div>
    </section>
  );
}

function ImplementationTypeSection({ tenant }: { tenant: PlatformTenantSummary }) {
  return (
    <section className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Implementation type</h2>
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

function DomainIntegrationStatusSection() {
  const status = getPlatformDomainIntegrationStatus();

  return (
    <section className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Domain integration</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Vercel domain integration: {status.configured ? "Configured" : "Needs configuration"}
          </p>
        </div>
        <span
          className={joinClasses(
            "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
            status.configured
              ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
              : "bg-amber-50 text-amber-700 ring-amber-200",
          )}
        >
          {status.configured ? "Configured" : "Incomplete"}
        </span>
      </div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Access token</dt>
          <dd className="mt-1 text-slate-900">{status.tokenConfigured ? "Set" : "Missing"}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Project ID</dt>
          <dd className="mt-1 text-slate-900">{status.projectConfigured ? "Set" : "Missing"}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Team ID</dt>
          <dd className="mt-1 text-slate-900">{status.teamConfigured ? "Set" : "Not set"}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Platform base domain</dt>
          <dd className="mt-1 text-slate-900">{status.platformBaseDomainConfigured ? "Set" : "Missing"}</dd>
        </div>
      </dl>
    </section>
  );
}

function BusinessAdminAccessSection({ tenant }: { tenant: PlatformTenantSummary }) {
  return (
    <section id="business-admin-access" className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Business admin access</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Assign an existing Supabase Auth user as owner for this exact business.
          </p>
        </div>
        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
          {tenant.signals.activeAdminMembershipCount} active
        </span>
      </div>

      <form action={assignBusinessAdminAction} className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <input type="hidden" name="tenantId" value={tenant.id} />
        <div>
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
        <FormSubmitButton loadingLabel="Assigning...">
          <UserPlusIcon className="h-4 w-4" />
          Add admin
        </FormSubmitButton>
      </form>
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
          <h2 className="text-sm font-semibold text-slate-900">Lifecycle</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Activation controls whether this tenant can be resolved as an active current-site business.
          </p>
        </div>
        <TenantStatusBadge tenant={tenant} />
      </div>

      {active ? (
        <form action={deactivateBusinessAction} className="mt-5 space-y-4">
          <input type="hidden" name="tenantId" value={tenant.id} />
          <Alert tone="warning">
            Deactivation does not delete settings, content, users, bookings, customers, or operational records.
          </Alert>
          <div>
            <label htmlFor="confirmationSlug" className="text-sm font-semibold text-slate-700">
              Type the slug to deactivate
            </label>
            <input
              id="confirmationSlug"
              name="confirmationSlug"
              type="text"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="mt-2 block h-11 w-full rounded-[8px] border border-slate-300 px-3 font-mono text-sm text-slate-900 shadow-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
              placeholder={tenant.slug}
              required
            />
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
                This extra confirmation is required because this slug is the configured current-site tenant.
              </p>
            </div>
          ) : null}
          <FormSubmitButton
            className="admin-btn admin-btn-destructive"
            loadingLabel="Deactivating..."
          >
            <PauseCircleIcon className="h-4 w-4" />
            Deactivate business
          </FormSubmitButton>
        </form>
      ) : (
        <form action={activateBusinessAction} className="mt-5 space-y-4">
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

  const { tenant, domains } = detail;
  const message = pageStatusMessage(search.status, search.error);
  const configuredCurrentSiteSlug = getConfiguredCurrentTenantSlug();
  const isCurrentSiteTenant = tenant.slug === configuredCurrentSiteSlug;

  return (
    <AdminPage width="wide" className="space-y-6 pt-2">
      <div>
        <Link
          href="/platform-admin/businesses"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Businesses
        </Link>
      </div>

      <AdminPageHeader
        eyebrow="Business"
        title={tenant.displayName}
        description={tenant.slug}
        actions={
          <>
            <TenantStatusBadge tenant={tenant} />
            <Link
              href={`/platform-admin/businesses/${tenant.id}/edit`}
              className="admin-btn admin-btn-secondary"
            >
              <PencilSquareIcon className="h-4 w-4" />
              Edit business
            </Link>
          </>
        }
      />

      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}

      {tenant.status !== "active" ? (
        <Alert tone="warning">
          This business is inactive and cannot be resolved as an active current-site tenant.
        </Alert>
      ) : tenant.setup.status === "needs_attention" ? (
        <Alert tone="warning">
          This business is active but setup still needs attention. Review the incomplete areas before routing traffic here.
        </Alert>
      ) : null}

      <LaunchReadinessSection tenant={tenant} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Basic tenant information</h2>
          <dl className="mt-4 space-y-4">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tenant UUID</dt>
              <dd className="mt-1 break-all text-sm text-slate-900">{tenant.id}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Slug</dt>
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

      <DomainIntegrationStatusSection />

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
