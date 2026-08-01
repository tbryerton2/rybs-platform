type AdminAuditHistoryCardProps = {
  title: string;
  beforeValue: string;
  afterValue: string;
  changedAt: string;
  changedBy?: string | null;
  formatDateTime: (value: string) => string;
};

export function AdminAuditHistoryCard({
  title,
  beforeValue,
  afterValue,
  changedAt,
  changedBy,
  formatDateTime,
}: AdminAuditHistoryCardProps) {
  return (
    <div className="min-w-0 rounded-[14px] border border-slate-200 bg-slate-50/70 px-4 py-4">
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <div className="mt-3 space-y-1 text-sm text-slate-600">
        <div className="min-w-0">
          <span className="font-medium text-slate-500">Change date:</span>{" "}
          <span className="whitespace-normal break-words">{formatDateTime(changedAt)}</span>
        </div>
        <div>
          <span className="font-medium text-slate-500">User:</span> {changedBy || "system"}
        </div>
      </div>
      <div className="my-3 border-t border-slate-200" />
      <div className="space-y-2 text-sm text-slate-600">
        <div className="min-w-0">
          <span className="mr-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Before:</span>
          <span className="whitespace-normal break-words">{beforeValue}</span>
        </div>
        <div className="min-w-0">
          <span className="mr-2 text-xs font-semibold uppercase tracking-wide text-slate-400">After:</span>
          <span className="whitespace-normal break-words">{afterValue}</span>
        </div>
      </div>
    </div>
  );
}
