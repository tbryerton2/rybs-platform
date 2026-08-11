import Link from "next/link";
import { EnvelopeIcon, KeyIcon } from "@heroicons/react/24/outline";
import { sendAdminPasswordResetAction } from "./actions";

type SearchParams = Record<string, string | string[] | undefined>;

function readValue(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function getMessage(searchParams: SearchParams) {
  if (readValue(searchParams, "sent") === "1") {
    return {
      tone: "success",
      text: "If that email has admin access, a password reset link has been sent.",
    } as const;
  }

  switch (readValue(searchParams, "error")) {
    case "invalid-email":
      return { tone: "error", text: "Enter a valid email address to continue." } as const;
    case "send-failed":
      return { tone: "error", text: "We could not send a reset link. Try again in a moment." } as const;
    default:
      return null;
  }
}

export default async function AdminForgotPasswordPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const message = getMessage(resolvedSearchParams);
  const email = readValue(resolvedSearchParams, "email") ?? "";

  return (
    <main className="mx-auto flex min-h-[calc(100vh-10rem)] max-w-5xl items-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="grid w-full overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.08)] lg:grid-cols-[0.95fr_1.05fr]">
        <section className="bg-slate-950 px-6 py-8 text-white sm:px-8 sm:py-10">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-[14px] bg-orange-500 text-white">
            <KeyIcon className="h-6 w-6" />
          </div>
          <p className="mt-7 text-xs font-semibold uppercase tracking-[0.22em] text-orange-200">
            Password recovery
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Reset your admin password
          </h1>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            We will send a secure Supabase Auth recovery link for your business-admin account.
          </p>
        </section>

        <section className="px-6 py-8 sm:px-8 sm:py-10">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-[14px] bg-orange-50 text-orange-600 ring-1 ring-orange-100">
            <EnvelopeIcon className="h-5 w-5" />
          </div>
          <h2 className="mt-5 text-2xl font-semibold tracking-tight text-slate-900">
            Send reset link
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Enter the email address for your admin account.
          </p>

          {message ? (
            <div
              className={[
                "mt-6 rounded-[14px] px-4 py-3 text-sm ring-1",
                message.tone === "success"
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                  : "bg-rose-50 text-rose-700 ring-rose-200",
              ].join(" ")}
            >
              {message.text}
            </div>
          ) : null}

          <form action={sendAdminPasswordResetAction} className="mt-7 space-y-5">
            <div>
              <label htmlFor="admin-reset-email" className="text-sm font-medium text-slate-700">
                Email address
              </label>
              <input
                id="admin-reset-email"
                name="email"
                type="email"
                required
                defaultValue={email}
                placeholder="owner@example.com"
                className="mt-2 w-full rounded-[14px] border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
              />
            </div>

            <button type="submit" className="admin-btn admin-btn-primary w-full">
              Send reset link
            </button>
          </form>

          <div className="mt-6 text-sm">
            <Link href="/admin/login" className="font-medium text-slate-700 hover:text-slate-950">
              Back to admin sign in
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
