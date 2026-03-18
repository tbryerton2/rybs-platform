import { Card } from "./Card";
import { formatUsd } from "@/lib/money";

export function RevenueMTDCard(props: { amount: number }) {
  return (
    <Card title="Revenue MTD" subtitle="Sum of delivered jobs this month">
      <div className="text-3xl font-semibold text-slate-900">
        {formatUsd(props.amount, { maximumFractionDigits: 0 })}
      </div>

      <div className="mt-2 text-xs text-slate-600">
        Based on bookings with status <span className="font-medium">delivered</span> or{" "}
        <span className="font-medium">picked_up</span> and delivery_date in the current month.
      </div>
    </Card>
  );
}
