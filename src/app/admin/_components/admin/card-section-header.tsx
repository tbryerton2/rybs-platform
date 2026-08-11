import type { ReactNode } from "react";

export function CardSectionHeader({
  title,
  icon,
}: {
  title: string;
  icon: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-[14px] bg-slate-100 text-slate-600">
        {icon}
      </span>
      <h2 className="text-[15px] font-medium uppercase tracking-[0.08em] text-[var(--text-secondary)]">
        {title}
      </h2>
    </div>
  );
}
