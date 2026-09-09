import { BuildingOffice2Icon, CheckCircleIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import { redirect } from "next/navigation";
import {
  AdminAccessDeniedError,
  getAdminBusinessSelectionContext,
} from "@/lib/admin/auth";
import { selectAdminBusinessAction } from "./actions";

type SearchParams = Record<string, string | string[] | undefined>;

function readValue(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function getErrorMessage(searchParams: SearchParams) {
  switch (readValue(searchParams, "error")) {
    case "missing-selection":
      return "Choose a business to continue.";
    case "invalid-selection":
      return "That business is not available for this admin account.";
    default:
      return null;
  }
}

function AdminAccessDenied({ message }: { message: string }) {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-10rem)] max-w-3xl items-center px-4 py-12 sm:px-6 lg:px-8">
      <section className="w-full rounded-[20px] border border-slate-200 bg-white px-6 py-10 text-center shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
        <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
          Admin access
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
          Access denied
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">{message}</p>
        <div className="mt-6">
          <a href="/admin/logout" className="admin-btn admin-btn-primary">
            Sign out
          </a>
        </div>
      </section>
    </main>
  );
}

export default async function AdminBusinessSelectPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const errorMessage = getErrorMessage(resolvedSearchParams);

  let context: Awaited<ReturnType<typeof getAdminBusinessSelectionContext>>;

  try {
    context = await getAdminBusinessSelectionContext();
  } catch (error) {
    if (error instanceof AdminAccessDeniedError) {
      return <AdminAccessDenied message={error.message} />;
    }

    throw error;
  }

  if (context.businesses.length === 1) {
    redirect("/admin");
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-10rem)] max-w-5xl items-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="grid w-full overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.08)] lg:grid-cols-[0.9fr_1.1fr]">
        <section className="bg-slate-950 px-6 py-8 text-white sm:px-8 sm:py-10">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-[14px] bg-orange-500 text-white">
            <ShieldCheckIcon className="h-6 w-6" />
          </div>
          <p className="mt-7 text-xs font-semibold uppercase tracking-[0.22em] text-orange-200">
            Business access
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Select a business
          </h1>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            This account can manage more than one business. Choose the workspace you want to use now.
          </p>
          <p className="mt-6 text-xs leading-5 text-slate-400">
            Signed in as {context.email ?? "an admin user"}
          </p>
        </section>

        <section className="px-6 py-8 sm:px-8 sm:py-10">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-[14px] bg-orange-50 text-orange-600 ring-1 ring-orange-100">
            <BuildingOffice2Icon className="h-5 w-5" />
          </div>
          <h2 className="mt-5 text-2xl font-semibold tracking-tight text-slate-900">
            Available businesses
          </h2>

          {errorMessage ? (
            <div className="mt-6 rounded-[14px] bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200">
              {errorMessage}
            </div>
          ) : null}

          <div className="mt-7 space-y-3">
            {context.businesses.map((business) => (
              <form key={business.id} action={selectAdminBusinessAction}>
                <input type="hidden" name="businessId" value={business.id} />
                <button
                  type="submit"
                  className="group flex w-full items-center justify-between gap-4 rounded-[16px] border border-slate-200 bg-slate-50 px-4 py-4 text-left transition hover:border-orange-200 hover:bg-orange-50/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-900">{business.name}</span>
                    <span className="mt-1 block text-xs text-slate-500">{business.slug}</span>
                  </span>
                  <CheckCircleIcon className="h-5 w-5 shrink-0 text-slate-300 transition group-hover:text-orange-500" />
                </button>
              </form>
            ))}
          </div>

          <div className="mt-7">
            <a href="/admin/logout" className="text-sm font-medium text-slate-500 hover:text-slate-900">
              Sign out
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
