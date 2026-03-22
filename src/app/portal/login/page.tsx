import { getOptionalPortalCustomer } from "@/lib/portal/auth";
import { redirect } from "next/navigation";
import { sendPortalLoginLinkAction } from "./actions";
import { PortalLoginForm } from "./login-form";

type SearchParams = Record<string, string | string[] | undefined>;

function readValue(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function getMessage(searchParams: SearchParams) {
  const error = readValue(searchParams, "error");
  const sent = readValue(searchParams, "sent");
  const email = readValue(searchParams, "email");

  if (sent === "1") {
    return {
      tone: "success",
      text: email
        ? `We sent a secure access link to ${email}.`
        : "We sent a secure access link to your email.",
    } as const;
  }

  switch (error) {
    case "invalid-email":
      return { tone: "error", text: "Enter a valid email address to continue." } as const;
    case "not-found":
      return {
        tone: "error",
        text: "We could not find a portal account for that email yet. Use the email you booked with.",
      } as const;
    case "send-failed":
      return {
        tone: "error",
        text: "We could not send your access link right now. Please try again.",
      } as const;
    case "rate-limited":
      return {
        tone: "error",
        text: "You requested too many access emails too quickly. Please wait a minute before trying again.",
      } as const;
    case "lookup-failed":
      return {
        tone: "error",
        text: "We hit a problem finding your portal account before sending the access email.",
      } as const;
    case "deactivated":
      return {
        tone: "error",
        text: "Portal access for this account is currently disabled. Please contact support if you need help.",
      } as const;
    case "invalid-link":
      return {
        tone: "error",
        text: "That access link is invalid or expired. Request a new one below.",
      } as const;
    default:
      return null;
  }
}

export default async function PortalLoginPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const customer = await getOptionalPortalCustomer();
  if (customer) redirect("/portal");

  const resolvedSearchParams = (await searchParams) ?? {};
  const message = getMessage(resolvedSearchParams);
  const email = readValue(resolvedSearchParams, "email") ?? "";
  const cooldown = Number(readValue(resolvedSearchParams, "cooldown") ?? "0");
  const error = readValue(resolvedSearchParams, "error");
  const isRateLimited = error === "rate-limited";
  const isDeactivated = error === "deactivated";

  return (
    <main className="mx-auto flex min-h-[calc(100vh-10rem)] max-w-6xl items-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="grid w-full gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[36px] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-6 py-8 text-white shadow-[0_30px_80px_rgba(15,23,42,0.2)] sm:px-8 sm:py-10">
          <div className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-orange-200">
            Customer portal
          </div>
          <h1 className="mt-6 max-w-lg text-4xl font-semibold tracking-tight sm:text-5xl">
            Access your bookings with the same email you used to book.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
            Manage current rentals, review past bookings, and start a new order with your previous setup already filled in.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              ["Track bookings", "See the latest status, timing, and next steps."],
              ["Manage online", "Request pickup, more time, or help in a few taps."],
              ["Book again", "Reuse a previous setup without starting from scratch."],
            ].map(([title, copy]) => (
              <div key={title} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="text-sm font-semibold text-white">{title}</div>
                <div className="mt-2 text-sm leading-6 text-slate-300">{copy}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[32px] border border-slate-200 bg-white px-6 py-8 shadow-[0_24px_60px_rgba(15,23,42,0.08)] sm:px-8">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
            Portal access
          </div>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
            Access your portal
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Use the same email you booked with. We will send a secure access link so you can open your portal and manage your bookings.
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            New here? Your booking email is enough to get started. Returning? Use that same email to get back into your portal securely.
          </p>

          {message ? (
            <div
              className={`mt-6 rounded-2xl px-4 py-3 text-sm ${
                message.tone === "success"
                  ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                  : "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
              }`}
            >
              {message.text}
            </div>
          ) : null}

          <PortalLoginForm
            action={sendPortalLoginLinkAction}
            initialEmail={email}
            initialCooldownSeconds={cooldown > 0 ? cooldown : undefined}
            blocked={isDeactivated}
          />

          {process.env.NODE_ENV === "development" && isRateLimited ? (
            <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800 ring-1 ring-amber-200">
              Local testing can hit Supabase built-in email limits quickly. Production should use
              custom SMTP with your allowed site and redirect URLs configured.
            </div>
          ) : null}

          <div className="mt-6 text-sm leading-6 text-slate-500">
            We will keep the experience secure and simple today, while leaving room for stronger account sign-in options later.
          </div>
        </section>
      </div>
    </main>
  );
}
