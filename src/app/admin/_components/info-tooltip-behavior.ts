export type TooltipState = "closed" | "preview" | "pinned";
export type TooltipAction = "preview" | "leave" | "toggle" | "dismiss";

export function tooltipReducer(state: TooltipState, action: TooltipAction): TooltipState {
  switch (action) {
    case "preview":
      return state === "pinned" ? state : "preview";
    case "leave":
      return state === "pinned" ? state : "closed";
    case "toggle":
      // Focus/hover can precede a click: the first click pins that preview open.
      return state === "pinned" ? "closed" : "pinned";
    case "dismiss":
      return "closed";
  }
}

export function tooltipPosition(
  anchor: { left: number; right: number; bottom: number; top: number },
  tooltip: { width: number; height: number },
  viewport: { left: number; top: number; width: number; height: number },
  align: "left" | "right",
) {
  const margin = 12;
  const gap = 8;
  const minLeft = viewport.left + margin;
  const minTop = viewport.top + margin;
  const maxLeft = Math.max(minLeft, viewport.left + viewport.width - tooltip.width - margin);
  const maxTop = Math.max(minTop, viewport.top + viewport.height - tooltip.height - margin);
  const below = anchor.bottom + gap;
  return {
    left: Math.max(minLeft, Math.min(align === "right" ? anchor.right - tooltip.width : anchor.left, maxLeft)),
    top: Math.max(minTop, Math.min(below <= maxTop ? below : anchor.top - tooltip.height - gap, maxTop)),
  };
}
