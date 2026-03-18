import { getPortalStageLabel, getPortalStageTone, type PortalStage } from "@/lib/portal/status";

export function PortalStatusBadge({ stage }: { stage: PortalStage }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${getPortalStageTone(
        stage,
      )}`}
    >
      {getPortalStageLabel(stage)}
    </span>
  );
}
