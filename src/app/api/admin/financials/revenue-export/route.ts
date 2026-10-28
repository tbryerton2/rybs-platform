import { NextResponse, type NextRequest } from "next/server";
import { requireAdminOwnerForApi } from "@/lib/admin/auth";
import { loadCollectionsReport } from "@/lib/financials/collections-server";
import { buildCollectionsCsv } from "@/lib/financials/collections-csv";
import { parseCompletionFilter } from "@/lib/financials/collections";

function isISODate(value: string | null) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function buildFilename(startDate: string, endDate: string, completion: string) {
  const range =
    startDate || endDate
      ? `${startDate || "start"}_to_${endDate || "today"}`
      : "all-time";

  return `money-collected-${range}-${completion}.csv`;
}

export async function GET(req: NextRequest) {
  const adminAuth = await requireAdminOwnerForApi();
  if (!adminAuth.ok) return adminAuth.response;

  const startDate = isISODate(req.nextUrl.searchParams.get("start"))
    ? req.nextUrl.searchParams.get("start")!
    : "";
  const endDate = isISODate(req.nextUrl.searchParams.get("end"))
    ? req.nextUrl.searchParams.get("end")!
    : "";

  const completion = parseCompletionFilter(req.nextUrl.searchParams.get("completion"));
  let report;
  try {
    report = await loadCollectionsReport(adminAuth.session.business.id, { completion, start: startDate, end: endDate });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to load payments." }, { status: 500 });
  }
  if (report.incompletePayments > 0) {
    return NextResponse.json({ ok: false, error: "Some payments are missing valid dates, USD amounts, or refund amounts. Resolve these records before exporting a complete report." }, { status: 422 });
  }
  const rows = report.rows;
  const csv = buildCollectionsCsv(rows);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${buildFilename(startDate, endDate, completion)}"`,
      "Cache-Control": "no-store",
    },
  });
}
