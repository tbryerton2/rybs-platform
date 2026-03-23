// src/app/admin/docs/page.tsx

import Link from "next/link";
import { AdminPage, AdminPageHeader } from "@/app/admin/_components/admin/admin-page";
import { docs } from "@/lib/admin/docs";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatLastReviewed(value?: string) {
  if (!value) return null;

  const parsed = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  }).format(parsed);
}

export default function AdminDocsPage() {
  const featuredDoc = docs.find((doc) => doc.featured) ?? docs[0];
  const otherDocs = docs.filter((doc) => doc.slug !== featuredDoc?.slug);
  const featuredPrimaryCards = featuredDoc?.summaryCards?.slice(0, 2) ?? [];
  const featuredSecondaryCards = featuredDoc?.summaryCards?.slice(2, 5) ?? [];

  return (
    <AdminPage>
      <AdminPageHeader
        title="Docs"
        description="Internal guides for running the business."
        className="mb-6"
      />

      {featuredDoc ? (
        <Link
          href={`/admin/docs/${featuredDoc.slug}`}
          className="group block overflow-hidden rounded-[32px] border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-7"
        >
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)] xl:items-start">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-orange-200">
                  Featured guide
                </span>
                {featuredDoc.badge ? (
                  <div className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300">
                    {featuredDoc.badge}
                  </div>
                ) : null}
                {featuredDoc.lastReviewed ? (
                  <div className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300">
                    Last reviewed {formatLastReviewed(featuredDoc.lastReviewed)}
                  </div>
                ) : null}
              </div>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-[2rem]">
                {featuredDoc.title}
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                {featuredDoc.description}
              </p>

              {featuredSecondaryCards.length ? (
                <div className="mt-5 flex flex-wrap gap-2">
                  {featuredSecondaryCards.map((card) => (
                    <span
                      key={card.label}
                      className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200"
                    >
                      {card.label}: {card.value}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="mt-6 inline-flex items-center text-sm font-medium text-orange-300">
                Open guide
                <span className="ml-2 transition group-hover:translate-x-0.5">
                  →
                </span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              {featuredPrimaryCards.map((card) => (
                <div
                  key={card.label}
                  className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm"
                >
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">
                    {card.label}
                  </div>
                  <div className="mt-2 text-base font-semibold text-white">
                    {card.value}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {card.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Link>
      ) : null}

      <div className="mt-8 mb-5 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Operations guides
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Additional manuals and reference guides for day-to-day admin work.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {otherDocs.map((doc) => (
          <Link
            key={doc.slug}
            href={`/admin/docs/${doc.slug}`}
            className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
          >
            <div className="flex h-full flex-col">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                  {doc.badge ?? "Guide"}
                </div>
                <h2 className="text-lg font-semibold text-slate-900 group-hover:text-[#F97316]">
                  {doc.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {doc.description}
                </p>
                {doc.lastReviewed ? (
                  <div className="mt-3 text-xs font-medium uppercase tracking-[0.12em] text-slate-400">
                    Last reviewed {formatLastReviewed(doc.lastReviewed)}
                  </div>
                ) : null}
              </div>

              <div className="mt-6 flex items-center text-sm font-medium text-[#F97316]">
                Open guide
                <span className="ml-2 transition group-hover:translate-x-0.5">
                  →
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </AdminPage>
  );
}
