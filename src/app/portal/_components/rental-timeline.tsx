import { CheckIcon } from "@heroicons/react/24/solid";
import { getTimelineStages, type PortalStage } from "@/lib/portal/status";

export function RentalTimeline({ stage }: { stage: PortalStage }) {
  const steps = getTimelineStages(stage);

  return (
    <div className="overflow-x-auto pb-2">
      <ol className="flex min-w-max gap-0">
        {steps.map((step, index) => {
          const isComplete = step.state === "complete";
          const isCurrent = step.state === "current";
          const isUpcoming = step.state === "upcoming";

          return (
            <li key={step.key} className="flex min-w-[132px] flex-1 items-start">
              <div className="min-w-0 flex-1">
                <div className="flex items-center">
                  <div
                    className={[
                      "relative z-10 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition",
                      isCurrent
                        ? "border-[#f97316] bg-[#f97316] text-white shadow-[0_10px_24px_rgba(249,115,22,0.18)]"
                        : isComplete
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-400",
                    ].join(" ")}
                  >
                    {isComplete ? <CheckIcon className="h-4.5 w-4.5" /> : index + 1}
                  </div>

                  {index < steps.length - 1 ? (
                    <div
                      className={[
                        "mx-3 h-[2px] flex-1 rounded-full",
                        isComplete ? "bg-slate-900" : "bg-slate-200",
                      ].join(" ")}
                    />
                  ) : null}
                </div>

                <div className="mt-3 pr-3">
                  <div className="text-sm font-semibold text-slate-900">{step.label}</div>
                  <div className="mt-1 text-xs leading-5 text-slate-500">
                    {isCurrent ? "Current" : isComplete ? "Completed" : isUpcoming ? "Upcoming" : ""}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
