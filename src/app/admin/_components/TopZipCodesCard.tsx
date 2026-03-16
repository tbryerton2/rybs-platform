import { Card } from "./Card";

export function TopZipCodesCard(props: {
  items: { zip: string; count: number }[];
}) {
  return (
    <Card title="Top ZIP Codes" subtitle="Last 30 days (by booking count)">
      {props.items.length === 0 ? (
        <div className="text-sm text-slate-600">No bookings in the last 30 days.</div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {props.items.map((z) => (
            <li key={z.zip} className="flex items-center justify-between py-3">
              <div className="text-sm font-medium text-slate-900">{z.zip}</div>
              <div className="text-sm text-slate-700">{z.count}</div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2 text-xs text-slate-600">
        (Later: connect this to the ZIP heat map.)
      </div>
    </Card>
  );
}