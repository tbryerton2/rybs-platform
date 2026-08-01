import { Card } from "./Card";

export function FleetCapacityCard(props: {
  fleetSize: number;
  deliveriesToday: number;
  onSiteNow: number;
}) {
  const availableNow = Math.max(props.fleetSize - props.onSiteNow, 0);
  const remainingToday = Math.max(props.fleetSize - props.deliveriesToday, 0);

  return (
    <Card title="Fleet Capacity" subtitle="Current utilization + today">
      <div className="mt-2 space-y-3">
        <div className="rounded-[14px] bg-slate-50 px-5 py-5 ring-1 ring-slate-200">
          <div className="space-y-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Fleet Size</span>
              <span className="font-semibold text-slate-900">{props.fleetSize}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-600">On-site now</span>
              <span className="font-semibold text-slate-900">{props.onSiteNow}</span>
            </div>

            <div className="border-t border-slate-200 pt-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-700">Available now</span>
                <span
                  className={`font-semibold ${
                    availableNow === 0 ? "text-red-600" : "text-emerald-600"
                  }`}
                >
                  {availableNow}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[14px] bg-slate-50 px-5 py-4 ring-1 ring-slate-200">
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Deliveries today</span>
              <span className="font-semibold text-slate-900">{props.deliveriesToday}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-700">Remaining capacity today</span>
              <span
                className={`font-semibold ${
                  remainingToday === 0 ? "text-red-600" : "text-slate-900"
                }`}
              >
                {remainingToday}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}