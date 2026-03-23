type AdminPageWidth = "standard" | "wide";

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function AdminPage({
  children,
  width = "standard",
  className,
}: {
  children: React.ReactNode;
  width?: AdminPageWidth;
  className?: string;
}) {
  return (
    <div
      className={joinClasses(
        "mx-auto w-full pb-16 pt-6",
        width === "wide" ? "max-w-[1680px]" : "max-w-[1400px]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function AdminPageHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={joinClasses(
        "mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <div className="text-sm font-medium text-slate-500">{eyebrow}</div>
        ) : null}
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            {description}
          </p>
        ) : null}
      </div>

      {actions ? (
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
