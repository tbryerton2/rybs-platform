import { getTimelineStages, type PortalStage } from "@/lib/portal/status";

export function RentalTimeline({ stage }: { stage: PortalStage }) {
  const steps = getTimelineStages(stage);

  return (
    <ol className="space-y-4">
      {steps.map((step, index) => {
        const isComplete = step.state === "complete";
        const isCurrent = step.state === "current";

        return (
          <li key={step.key} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div
                className={[
                  "flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold",
                  isCurrent
                    ? "border-[#F97316] bg-[#F97316] text-white"
                    : isComplete
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-400",
                ].join(" ")}
              >
                {index + 1}
              </div>
              {index < steps.length - 1 ? <div className="mt-2 h-full w-px bg-slate-200" /> : null}
            </div>

            <div className="pb-6">
              <div className="text-sm font-semibold text-slate-900">{step.label}</div>
              <div className="mt-1 text-sm text-slate-500">
                {isCurrent
                  ? "This is the current stage of your rental."
                  : isComplete
                    ? "Completed."
                    : "Upcoming."}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
