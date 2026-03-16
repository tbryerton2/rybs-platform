import { Card } from "./Card";

function formatUSD(amount: number) {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function RevenueMTDCard(props: { amount: number }) {
  return (
    <Card title="Revenue MTD" subtitle="Sum of delivered jobs this month">
      <div className="text-3xl font-semibold text-slate-900">
        {formatUSD(props.amount)}
      </div>

      <div className="mt-2 text-xs text-slate-600">
        Based on bookings with status <span className="font-medium">delivered</span> or{" "}
        <span className="font-medium">picked_up</span> and delivery_date in the current month.
      </div>
    </Card>
  );
}