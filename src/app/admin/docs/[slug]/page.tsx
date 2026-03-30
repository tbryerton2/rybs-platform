// src/app/admin/docs/[slug]/page.tsx

import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPage } from "@/app/admin/_components/admin/admin-page";
import { docs, getDocBySlug } from "@/lib/admin/docs";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{ slug: string }>;
};

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

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function calloutToneClasses(tone?: "info" | "warning" | "success") {
  switch (tone) {
    case "warning":
      return "border-amber-200 bg-amber-50/80 text-amber-950";
    case "success":
      return "border-emerald-200 bg-emerald-50/80 text-emerald-950";
    default:
      return "border-sky-200 bg-sky-50/80 text-sky-950";
  }
}

export async function generateStaticParams() {
  return docs.map((doc) => ({
    slug: doc.slug,
  }));
}

export default async function AdminDocDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const doc = getDocBySlug(slug);

  if (!doc) {
    notFound();
  }

  const anchors = doc.sections.map((section) => ({
    id: section.id ?? slugify(section.heading),
    label: section.heading,
  }));

  return (
    <AdminPage>
      <div className="mb-6">
        <Link
          href="/admin/docs"
          className="inline-flex items-center text-sm font-medium text-[#F97316] hover:text-orange-600"
        >
          ← Back to Guides
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_260px]">
        <article className="min-w-0 space-y-6">
          <header className="overflow-hidden rounded-[32px] border border-slate-200 bg-gradient-to-br from-white via-white to-slate-50 p-8 shadow-sm sm:p-10">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-3">
                {doc.badge ? (
                  <div className="inline-flex rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#F97316]">
                    {doc.badge}
                  </div>
                ) : null}
                {doc.lastReviewed ? (
                  <div className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500">
                    Last reviewed: {formatLastReviewed(doc.lastReviewed)}
                  </div>
                ) : null}
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                {doc.title}
              </h1>
              <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
                {doc.description}
              </p>
            </div>

            {doc.summaryCards?.length ? (
              <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {doc.summaryCards.map((card) => (
                  <section
                    key={card.label}
                    className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      {card.label}
                    </div>
                    <div className="mt-2 text-xl font-semibold text-slate-900">
                      {card.value}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {card.description}
                    </p>
                  </section>
                ))}
              </div>
            ) : null}
          </header>

          {doc.quickAnswer ? (
            <section className="rounded-[32px] border border-sky-200 bg-sky-50/80 p-6 shadow-sm sm:p-8">
              <div className="max-w-4xl">
                <div className="inline-flex rounded-full border border-sky-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-sky-700">
                  {doc.quickAnswer.label}
                </div>
                <h2 className="mt-4 text-xl font-semibold text-slate-900 sm:text-2xl">
                  {doc.quickAnswer.title}
                </h2>
                <p className="mt-3 text-sm leading-7 text-slate-700 sm:text-[15px]">
                  {doc.quickAnswer.body}
                </p>
              </div>
            </section>
          ) : null}

          {doc.relationshipDiagram ? (
            <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="mb-5">
                <h2 className="text-xl font-semibold text-slate-900">
                  Relationship map
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Use this as the quick mental model for how account identity and
                  booking identity relate inside the platform.
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(220px,0.9fr)_auto_minmax(0,1.2fr)] lg:items-center">
                <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Customer account
                  </div>
                  <div className="mt-2 text-lg font-semibold text-slate-900">
                    {doc.relationshipDiagram.customerAccount}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    One portal account, one customer UUID, current account email.
                  </p>
                </div>

                <div className="hidden items-center justify-center lg:flex">
                  <div className="rounded-full border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-semibold text-[#F97316]">
                    {doc.relationshipDiagram.bookingRelationship}
                  </div>
                </div>

                <div className="rounded-[28px] border border-slate-200 bg-white p-5">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Each booking keeps
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {doc.relationshipDiagram.bookingDetails.map((detail) => (
                      <div
                        key={detail}
                        className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 text-sm font-medium text-slate-700"
                      >
                        {detail}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {doc.comparisonTable ? (
            <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="mb-5">
                <h2 className="text-xl font-semibold text-slate-900">
                  Comparison guide
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  This table is the fastest way to explain which identity the team
                  should use in each situation.
                </p>
              </div>

              <div className="overflow-hidden rounded-[24px] border border-slate-200">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-slate-900">
                          Record type
                        </th>
                        {doc.comparisonTable.columns.map((column) => (
                          <th
                            key={column}
                            className="px-4 py-3 text-left font-semibold text-slate-900"
                          >
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {doc.comparisonTable.rows.map((row) => (
                        <tr key={row.label} className="align-top">
                          <th className="px-4 py-4 text-left font-semibold text-slate-900">
                            {row.label}
                          </th>
                          {row.values.map((value, index) => (
                            <td
                              key={`${row.label}-${index}`}
                              className="px-4 py-4 leading-6 text-slate-600"
                            >
                              {value}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          ) : null}

          <div className="space-y-6">
            {doc.sections.map((section) => {
              const sectionId = section.id ?? slugify(section.heading);

              return (
                <section
                  key={section.heading}
                  id={sectionId}
                  className="scroll-mt-24 rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
                >
                  <div className="max-w-3xl">
                    <h2 className="text-xl font-semibold text-slate-900">
                      {section.heading}
                    </h2>
                    {section.lead ? (
                      <p className="mt-2 text-base leading-7 text-slate-700">
                        {section.lead}
                      </p>
                    ) : null}

                    {section.paragraphs?.length ? (
                      <div className="mt-4 space-y-4">
                        {section.paragraphs.map((paragraph, index) => (
                          <p
                            key={`${section.heading}-p-${index}`}
                            className="text-sm leading-7 text-slate-600 sm:text-[15px]"
                          >
                            {paragraph}
                          </p>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  {section.bullets?.length ? (
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      {section.bullets.map((bullet, index) => (
                        <div
                          key={`${section.heading}-b-${index}`}
                          className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 text-sm leading-6 text-slate-700"
                        >
                          {bullet}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {section.callout ? (
                    <div
                      className={`mt-5 rounded-3xl border px-5 py-4 ${calloutToneClasses(section.callout.tone)}`}
                    >
                      <div className="text-sm font-semibold">
                        {section.callout.title}
                      </div>
                      <p className="mt-1 text-sm leading-6 opacity-90">
                        {section.callout.body}
                      </p>
                    </div>
                  ) : null}
                </section>
              );
            })}
          </div>

          {doc.scenarios?.length ? (
            <section
              id="common-real-world-scenarios"
              className="scroll-mt-24 rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
            >
              <div className="mb-5 max-w-3xl">
                <h2 className="text-xl font-semibold text-slate-900">
                  Common real-world scenarios
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  These examples are written to match what staff actually see in
                  support and operations.
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {doc.scenarios.map((scenario) => (
                  <section
                    key={scenario.title}
                    className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-5"
                  >
                    <h3 className="text-base font-semibold text-slate-900">
                      {scenario.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {scenario.summary}
                    </p>
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm leading-6 text-slate-700">
                      {scenario.guidance}
                    </div>
                  </section>
                ))}
              </div>
            </section>
          ) : null}

          {doc.faq?.length ? (
            <section
              id="faq"
              className="scroll-mt-24 rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
            >
              <div className="mb-5 max-w-3xl">
                <h2 className="text-xl font-semibold text-slate-900">FAQ</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Quick answers to the questions that come up most often during
                  support, onboarding, and account cleanup.
                </p>
              </div>

              <div className="space-y-3">
                {doc.faq.map((item) => (
                  <details
                    key={item.question}
                    className="group rounded-[24px] border border-slate-200 bg-slate-50/70 px-5 py-4"
                  >
                    <summary className="cursor-pointer list-none pr-8 text-sm font-semibold text-slate-900">
                      {item.question}
                    </summary>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      {item.answer}
                    </p>
                  </details>
                ))}
              </div>
            </section>
          ) : null}

          {doc.checklist ? (
            <section
              id="staff-checklist"
              className="scroll-mt-24 rounded-[32px] border border-slate-200 bg-slate-950 p-6 text-white shadow-sm sm:p-8"
            >
              <div className="max-w-3xl">
                <h2 className="text-xl font-semibold">{doc.checklist.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Use this checklist when a support question touches customer
                  identity, booking identity, or portal access.
                </p>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-2">
                {doc.checklist.items.map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm leading-6 text-slate-100"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </article>

        <aside className="hidden xl:block">
          <div className="sticky top-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              On this page
            </div>
            <nav className="mt-4 space-y-1">
              {anchors.map((anchor) => (
                <a
                  key={anchor.id}
                  href={`#${anchor.id}`}
                  className="block rounded-2xl px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                >
                  {anchor.label}
                </a>
              ))}
              {doc.scenarios?.length ? (
                <a
                  href="#common-real-world-scenarios"
                  className="block rounded-2xl px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                >
                  Common real-world scenarios
                </a>
              ) : null}
              {doc.faq?.length ? (
                <a
                  href="#faq"
                  className="block rounded-2xl px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                >
                  FAQ
                </a>
              ) : null}
              {doc.checklist ? (
                <a
                  href="#staff-checklist"
                  className="block rounded-2xl px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                >
                  Staff checklist
                </a>
              ) : null}
            </nav>
          </div>
        </aside>
      </div>
    </AdminPage>
  );
}
