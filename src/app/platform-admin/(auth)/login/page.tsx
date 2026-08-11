import { KeyIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import { redirect } from "next/navigation";
import { getOptionalPlatformAdminSession } from "@/lib/platform-admin/auth";
import { signInPlatformAdminWithPasswordAction } from "./actions";

type SearchParams = Record<string, string | string[] | undefined>;

function readValue(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function getMessage(searchParams: SearchParams) {
  const error = readValue(searchParams, "error");

  switch (error) {
    case "invalid-email":
      return { tone: "error", text: "Enter a valid email address to continue." } as const;
    case "missing-password":
      return { tone: "error", text: "Enter your platform admin password to continue." } as const;
    case "invalid-credentials":
      return { tone: "error", text: "The email or password is incorrect." } as const;
    default:
      return null;
  }
}

export default async function PlatformAdminLoginPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const session = await getOptionalPlatformAdminSession();

  if (session) {
    redirect("/platform-admin");
  }

  const resolvedSearchParams = (await searchParams) ?? {};
  const message = getMessage(resolvedSearchParams);
  const email = readValue(resolvedSearchParams, "email") ?? "";

  return (
    <main className="mx-auto flex min-h-[calc(100vh-10rem)] max-w-5xl items-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="grid w-full overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.08)] lg:grid-cols-[0.95fr_1.05fr]">
        <section className="bg-slate-950 px-6 py-8 text-white sm:px-8 sm:py-10">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-[14px] bg-sky-500 text-white">
            <ShieldCheckIcon className="h-6 w-6" />
          </div>
          <p className="mt-7 text-xs font-semibold uppercase tracking-[0.22em] text-sky-200">
            Platform access
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Sign in to Platform Admin
          </h1>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            Use the email and password for your platform account. Platform membership is checked after sign-in.
          </p>
        </section>

        <section className="px-6 py-8 sm:px-8 sm:py-10">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-[14px] bg-sky-50 text-sky-600 ring-1 ring-sky-100">
            <KeyIcon className="h-5 w-5" />
          </div>
          <h2 className="mt-5 text-2xl font-semibold tracking-tight text-slate-900">
            Platform Admin sign in
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Supabase Auth verifies your credentials before platform access is checked.
          </p>

          {message ? (
            <div className="mt-6 rounded-[14px] bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200">
              {message.text}
            </div>
          ) : null}

          <form action={signInPlatformAdminWithPasswordAction} className="mt-7 space-y-5">
            <div>
              <label htmlFor="platform-admin-email" className="text-sm font-medium text-slate-700">
                Email address
              </label>
              <input
                id="platform-admin-email"
                name="email"
                type="email"
                required
                defaultValue={email}
                placeholder="owner@example.com"
                className="mt-2 w-full rounded-[14px] border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
              />
            </div>

            <div>
              <label htmlFor="platform-admin-password" className="text-sm font-medium text-slate-700">
                Password
              </label>
              <input
                id="platform-admin-password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="mt-2 w-full rounded-[14px] border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
              />
            </div>

            <button type="submit" className="admin-btn admin-btn-primary w-full">
              Sign in
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
