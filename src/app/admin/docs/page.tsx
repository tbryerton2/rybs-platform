// src/app/admin/docs/page.tsx

import Link from "next/link";
import { docs } from "@/lib/admin/docs";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminDocsPage() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          Docs
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Internal guides for running the business.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {docs.map((doc) => (
          <Link
            key={doc.slug}
            href={`/admin/docs/${doc.slug}`}
            className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
          >
            <div className="flex h-full flex-col">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 group-hover:text-[#F97316]">
                  {doc.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {doc.description}
                </p>
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
    </div>
  );
}