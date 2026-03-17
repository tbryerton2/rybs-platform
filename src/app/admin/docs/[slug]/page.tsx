// src/app/admin/docs/[slug]/page.tsx

import Link from "next/link";
import { notFound } from "next/navigation";
import { docs, getDocBySlug } from "@/lib/admin/docs";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{ slug: string }>;
};

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

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6">
        <Link
          href="/admin/docs"
          className="inline-flex items-center text-sm font-medium text-[#F97316] hover:text-orange-600"
        >
          ← Back to Docs
        </Link>
      </div>

      <article className="rounded-[32px] border border-slate-200 bg-white px-8 py-8 shadow-sm sm:px-10 sm:py-10">
        <header className="border-b border-slate-200 pb-6">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            {doc.title}
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {doc.description}
          </p>
        </header>

        <div className="mt-8 space-y-10">
          {doc.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-xl font-semibold text-slate-900">
                {section.heading}
              </h2>

              {section.paragraphs?.length ? (
                <div className="mt-3 space-y-4">
                  {section.paragraphs.map((paragraph, index) => (
                    <p
                      key={`${section.heading}-p-${index}`}
                      className="text-sm leading-7 text-slate-700"
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
              ) : null}

              {section.bullets?.length ? (
                <ul className="mt-4 space-y-3 pl-5 text-sm leading-7 text-slate-700">
                  {section.bullets.map((bullet, index) => (
                    <li
                      key={`${section.heading}-b-${index}`}
                      className="list-disc marker:text-slate-400"
                    >
                      {bullet}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>
      </article>
    </div>
  );
}