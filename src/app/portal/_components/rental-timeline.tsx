import { CheckIcon } from "@heroicons/react/24/solid";
import { getTimelineStages, type PortalStage } from "@/lib/portal/status";

export function RentalTimeline({ stage }: { stage: PortalStage }) {
  const steps = getTimelineStages(stage);

  return (
    <ol
      className="grid items-start gap-0"
      style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
    >
        {steps.map((step, index) => {
          const isComplete = step.state === "complete";
          const isCurrent = step.state === "current";
          const previousStep = steps[index - 1];
          const leftLineComplete = previousStep ? previousStep.state !== "upcoming" : false;
          const rightLineComplete = isComplete;

          return (
            <li key={step.key} className="relative flex min-w-0 flex-col items-center px-1 text-center">
                {index > 0 ? (
                  <div
                    className={[
                      "absolute left-0 top-5 h-[2px] w-1/2",
                      leftLineComplete ? "bg-slate-900" : "bg-slate-200",
                    ].join(" ")}
                  />
                ) : null}
                {index < steps.length - 1 ? (
                  <div
                    className={[
                      "absolute right-0 top-5 h-[2px] w-1/2",
                      rightLineComplete ? "bg-slate-900" : "bg-slate-200",
                    ].join(" ")}
                  />
                ) : null}

                <div
                  className={[
                    "relative z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border text-sm font-semibold transition",
                    isCurrent
                      ? "border-[#f97316] bg-[#f97316] text-white shadow-[0_10px_24px_rgba(249,115,22,0.18)]"
                      : isComplete
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-400",
                  ].join(" ")}
                >
                  {isComplete ? <CheckIcon className="h-4.5 w-4.5" /> : index + 1}
                </div>

                <div className="mt-3 min-w-0 px-1">
                  <div className="text-xs font-semibold leading-5 text-slate-900 sm:text-sm">{step.label}</div>
                </div>
            </li>
          );
        })}
    </ol>
  );
}
