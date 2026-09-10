export const dynamic = "force-dynamic";
export const revalidate = 0;

import {
  ArrowPathIcon,
  CheckCircleIcon,
  CreditCardIcon,
  ExclamationTriangleIcon,
  LinkIcon,
  NoSymbolIcon,
} from "@heroicons/react/24/outline";
import { AdminPage, AdminPageHeader } from "@/app/admin/_components/admin/admin-page";
import { FormSubmitButton } from "@/app/admin/_components/admin/form-submit-button";
import { adminButtonClassName } from "@/app/admin/_components/admin/admin-button";
import { requireAdminOwner } from "@/lib/admin/auth";
import {
  getSquareOAuthConfigurationStatus,
  getTenantSquareConnectionForAdmin,
  listTenantSquareConnectionLocationsForAdmin,
  type SquareLocationOption,
  TenantPaymentProviderConnectionError,
} from "@/lib/payments/tenant-payment-provider-connections";
import {
  revokeSquareConnectionAction,
  selectSquareLocationAction,
  startSquareOAuthAction,
} from "./actions";

type SearchParams = Record<string, string | string[] | undefined>;

function readValue(searchParams: SearchParams, key: string) {
  const value = searchParams[key];
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function formatDateTime(value: string | null) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatStatus(value: string | null | undefined) {
  if (!value) return "Not connected";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function messageFor(searchParams: SearchParams) {
  const success = readValue(searchParams, "success");
  if (success === "square-connected") {
    return { tone: "success" as const, text: "Square is connected and ready for card payments." };
  }
  if (success === "square-connected-select-location") {
    return { tone: "success" as const, text: "Square is connected. Select the location this business should use for payments." };
  }
  if (success === "square-location-selected") {
    return { tone: "success" as const, text: "Square location saved." };
  }
  if (success === "square-revoked") {
    return { tone: "success" as const, text: "Square access was revoked for this business." };
  }

  const error = readValue(searchParams, "error");
  if (!error) return null;

  const labels: Record<string, string> = {
    SQUARE_OAUTH_CONFIGURATION_MISSING: "Square OAuth is not fully configured yet.",
    SQUARE_OAUTH_DENIED: "Square authorization was canceled or denied.",
    SQUARE_OAUTH_CALLBACK_INVALID: "Square returned an incomplete authorization response.",
    SQUARE_OAUTH_STATE_INVALID: "Square authorization expired or did not match this admin session.",
    SQUARE_LOCATION_SELECTION_REQUIRED: "Choose a Square location before saving.",
    SQUARE_LOCATION_NOT_FOUND: "That Square location was not available for this connection.",
    SQUARE_REVOKE_CONFIRMATION_REQUIRED: "Type revoke before disconnecting Square.",
    SQUARE_API_REQUEST_FAILED: "Square could not complete the request.",
    TOKEN_ENCRYPTION_KEY_MISSING: "Token encryption is not configured.",
    TOKEN_ENCRYPTION_KEY_INVALID: "Token encryption key is not valid.",
  };

  return {
    tone: "error" as const,
    text: labels[error] ?? "Square connection could not be updated.",
  };
}

function Notice({
  tone,
  text,
}: {
  tone: "success" | "error" | "warning";
  text: string;
}) {
  const Icon = tone === "success" ? CheckCircleIcon : ExclamationTriangleIcon;
  return (
    <div
      className={[
        "mb-6 flex items-start gap-3 rounded-lg border px-4 py-3 text-sm",
        tone === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : tone === "warning"
            ? "border-amber-200 bg-amber-50 text-amber-800"
            : "border-rose-200 bg-rose-50 text-rose-800",
      ].join(" ")}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
      <p>{text}</p>
    </div>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium text-slate-900">{value}</dd>
    </div>
  );
}

function StatusPill({ status }: { status: string | null | undefined }) {
  const active = status === "active";
  const pending = status === "pending";

  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
        active
          ? "bg-emerald-100 text-emerald-700"
          : pending
            ? "bg-amber-100 text-amber-700"
            : "bg-slate-100 text-slate-600",
      ].join(" ")}
    >
      {formatStatus(status)}
    </span>
  );
}

function SquareConfigurationPanel({
  configured,
  missing,
  redirectUrl,
  webhookSignatureConfigured,
  webhookNotificationUrl,
}: ReturnType<typeof getSquareOAuthConfigurationStatus>) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
          <CreditCardIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-slate-950">Square application setup</h2>
            <StatusPill status={configured ? "active" : "pending"} />
          </div>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Detail label="Application ID" value={configured || missing.includes("Square OAuth application ID") ? (missing.includes("Square OAuth application ID") ? "Missing" : "Configured") : "Configured"} />
            <Detail label="Application secret" value={missing.includes("Square OAuth application secret") ? "Missing" : "Configured"} />
            <Detail label="Redirect URL" value={redirectUrl ? <span className="font-mono text-xs">{redirectUrl}</span> : "Missing"} />
            <Detail label="Token encryption" value={missing.includes("payment-provider token encryption key") ? "Missing" : "Configured"} />
            <Detail label="Webhook signature" value={webhookSignatureConfigured ? "Configured" : "Missing"} />
            <Detail label="Webhook URL" value={webhookNotificationUrl ? <span className="font-mono text-xs">{webhookNotificationUrl}</span> : "Missing"} />
          </dl>
          {missing.length ? (
            <div className="mt-4 text-sm leading-6 text-amber-700">
              Missing before live connection: {missing.join(", ")}.
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function LocationSelectionForm({
  connectionId,
  selectedLocationId,
  locations,
}: {
  connectionId: string;
  selectedLocationId: string | null;
  locations: SquareLocationOption[];
}) {
  if (!locations.length) {
    return (
      <Notice
        tone="warning"
        text="Square did not return any locations for this seller account. Reconnect after checking the seller's Square account."
      />
    );
  }

  return (
    <form action={selectSquareLocationAction} className="mt-5 space-y-4">
      <input type="hidden" name="connectionId" value={connectionId} />
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-slate-700">Square location</span>
        <select
          name="locationId"
          defaultValue={selectedLocationId ?? ""}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
          required
        >
          <option value="" disabled>
            Select a Square location
          </option>
          {locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.name}
              {location.status ? ` · ${formatStatus(location.status.toLowerCase())}` : ""}
              {location.addressSummary ? ` · ${location.addressSummary}` : ""}
            </option>
          ))}
        </select>
      </label>
      <FormSubmitButton loadingLabel="Saving location...">Save Location</FormSubmitButton>
    </form>
  );
}

export default async function AdminPaymentSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const adminSession = await requireAdminOwner();
  const [config, connection] = await Promise.all([
    Promise.resolve(getSquareOAuthConfigurationStatus()),
    getTenantSquareConnectionForAdmin({ businessId: adminSession.businessId }),
  ]);
  const message = messageFor(resolvedSearchParams);
  let locations: SquareLocationOption[] = [];
  let locationsError: string | null = null;

  if (connection?.canLoadLocations && connection.status !== "revoked") {
    try {
      locations = await listTenantSquareConnectionLocationsForAdmin({
        businessId: adminSession.businessId,
        connectionId: connection.id,
      });
    } catch (error) {
      locationsError =
        error instanceof TenantPaymentProviderConnectionError
          ? error.message
          : "Square locations could not be loaded.";
    }
  }

  return (
    <AdminPage>
      <AdminPageHeader
        title="Payments"
        description="Connect this business to its own Square seller account and choose the location used for card payments."
        actions={
          <form action={startSquareOAuthAction}>
            <FormSubmitButton
              loadingLabel={connection ? "Reconnecting..." : "Connecting..."}
              className={adminButtonClassName({ variant: "primary" })}
              disabled={!config.configured}
            >
              {connection ? "Reconnect Square" : "Connect Square"}
            </FormSubmitButton>
          </form>
        }
      />

      {message ? <Notice tone={message.tone} text={message.text} /> : null}
      {!config.configured ? (
        <Notice
          tone="warning"
          text="Square OAuth can be reviewed here, but connecting a real merchant requires the missing server-side configuration first."
        />
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
              {connection?.status === "active" ? (
                <CheckCircleIcon className="h-5 w-5" />
              ) : (
                <LinkIcon className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-slate-950">Tenant Square connection</h2>
                <StatusPill status={connection?.status} />
              </div>

              {connection ? (
                <>
                  <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                    <Detail label="Environment" value={formatStatus(connection.providerEnvironment)} />
                    <Detail label="Merchant ID" value={connection.providerMerchantId ? <span className="font-mono text-xs">{connection.providerMerchantId}</span> : "Not recorded"} />
                    <Detail label="Location" value={connection.providerLocationName ?? "Not selected"} />
                    <Detail label="Location ID" value={connection.providerLocationId ? <span className="font-mono text-xs">{connection.providerLocationId}</span> : "Not selected"} />
                    <Detail label="Connected" value={formatDateTime(connection.connectedAt)} />
                    <Detail label="Connection expires" value={formatDateTime(connection.expiresAt)} />
                  </dl>

                  {connection.grantedScopes.length ? (
                    <div className="mt-5">
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                        Granted scopes
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {connection.grantedScopes.map((scope) => (
                          <span key={scope} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                            {scope}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {locationsError ? <Notice tone="error" text={locationsError} /> : null}
                  <LocationSelectionForm
                    connectionId={connection.id}
                    selectedLocationId={connection.providerLocationId}
                    locations={locations}
                  />

                  <div className="mt-6 border-t border-slate-200 pt-5">
                    <form action={revokeSquareConnectionAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
                      <input type="hidden" name="connectionId" value={connection.id} />
                      <label className="block flex-1">
                        <span className="mb-1 block text-sm font-semibold text-slate-700">
                          Type revoke to disconnect Square
                        </span>
                        <input
                          name="confirmRevoke"
                          autoComplete="off"
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                        />
                      </label>
                      <FormSubmitButton
                        loadingLabel="Revoking..."
                        className={adminButtonClassName({ variant: "destructive" })}
                        disabled={!config.configured}
                      >
                        Revoke Access
                      </FormSubmitButton>
                    </form>
                  </div>
                </>
              ) : (
                <div className="mt-5 flex items-start gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                  <NoSymbolIcon className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
                  <p>
                    This business is not connected to its own Square seller account. Tan Can Man can temporarily use the legacy global Square fallback; other tenants require a tenant-owned Square connection before online card payments are enabled.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        <div className="space-y-6">
          <SquareConfigurationPanel {...config} />
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                <ArrowPathIcon className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-950">Legacy fallback</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  The temporary global Square fallback remains limited to Tan Can Man until that tenant has an active connection. Demo and future tenants do not silently use Tan Can Man payment credentials.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </AdminPage>
  );
}
