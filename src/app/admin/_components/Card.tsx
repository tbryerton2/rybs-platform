import Link from "next/link";
import type { ReactNode } from "react";

export function Card(props: {
  title: string;
  subtitle?: string;
  actionHref?: string;
  actionLabel?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[14px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">{props.title}</div>
          {props.subtitle ? (
            <div className="mt-0.5 text-xs text-slate-600">{props.subtitle}</div>
          ) : null}
        </div>

        {props.actionHref ? (
          <Link
            href={props.actionHref}
            className="shrink-0 rounded-[4px] px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            {props.actionLabel ?? "View"}
          </Link>
        ) : null}
      </div>

      {props.children}
    </div>
  );
}