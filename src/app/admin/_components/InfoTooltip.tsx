"use client";

import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { useEffect, useId, useLayoutEffect, useReducer, useRef } from "react";
import { createPortal } from "react-dom";
import { tooltipPosition, tooltipReducer } from "./info-tooltip-behavior";

export function InfoTooltip({
  label,
  body,
  align = "left",
  className = "text-slate-400 hover:text-slate-600",
  iconClassName = "h-4.5 w-4.5",
}: {
  label: string;
  body: string;
  align?: "left" | "right";
  className?: string;
  iconClassName?: string;
}) {
  const [state, dispatch] = useReducer(tooltipReducer, "closed");
  const open = state !== "closed";
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function cancelClose() {
    if (closeTimer.current !== null) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }

  function preview() {
    cancelClose();
    dispatch("preview");
  }

  function leave() {
    cancelClose();
    // Allow the pointer to cross the gap into the tooltip.
    closeTimer.current = setTimeout(() => dispatch("leave"), 120);
  }

  useEffect(() => () => cancelClose(), []);

  useEffect(() => {
    if (!open) return;
    function dismissOutside(event: Event) {
      if (event.target instanceof Node &&
          !triggerRef.current?.contains(event.target) &&
          !tooltipRef.current?.contains(event.target)) {
        cancelClose();
        dispatch("dismiss");
      }
    }
    function dismissEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        cancelClose();
        dispatch("dismiss");
      }
    }
    document.addEventListener("pointerdown", dismissOutside, true);
    document.addEventListener("focusin", dismissOutside);
    document.addEventListener("keydown", dismissEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside, true);
      document.removeEventListener("focusin", dismissOutside);
      document.removeEventListener("keydown", dismissEscape);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    function reposition() {
      const trigger = triggerRef.current;
      const tooltip = tooltipRef.current;
      if (!trigger || !tooltip) return;
      const visualViewport = window.visualViewport;
      const viewport = {
        left: visualViewport?.offsetLeft ?? 0,
        top: visualViewport?.offsetTop ?? 0,
        width: visualViewport?.width ?? document.documentElement.clientWidth,
        height: visualViewport?.height ?? document.documentElement.clientHeight,
      };
      tooltip.style.maxWidth = `${Math.max(0, viewport.width - 24)}px`;
      tooltip.style.maxHeight = `${Math.max(0, viewport.height - 24)}px`;
      const position = tooltipPosition(trigger.getBoundingClientRect(), tooltip.getBoundingClientRect(), viewport, align);
      tooltip.style.left = `${position.left}px`;
      tooltip.style.top = `${position.top}px`;
      tooltip.style.visibility = "visible";
    }
    reposition();
    const observer = new ResizeObserver(reposition);
    if (triggerRef.current) observer.observe(triggerRef.current);
    if (tooltipRef.current) observer.observe(tooltipRef.current);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    window.visualViewport?.addEventListener("resize", reposition);
    window.visualViewport?.addEventListener("scroll", reposition);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
      window.visualViewport?.removeEventListener("resize", reposition);
      window.visualViewport?.removeEventListener("scroll", reposition);
    };
  }, [open, align]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        className={`relative z-20 rounded-full p-0.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/80 focus-visible:ring-offset-2 ${className}`}
        onPointerEnter={(event) => {
          if (event.pointerType !== "touch") preview();
        }}
        onPointerLeave={leave}
        onFocus={preview}
        onBlur={leave}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          cancelClose();
          dispatch("toggle");
        }}
      >
        <InformationCircleIcon className={iconClassName} aria-hidden="true" />
      </button>
      {open ? createPortal(
        <span
          ref={tooltipRef}
          id={id}
          role="tooltip"
          className="fixed z-50 w-64 overflow-auto break-words rounded-[14px] border border-slate-200/90 bg-white px-3.5 py-2.5 text-left text-xs font-medium leading-5 text-slate-600 shadow-[0_16px_36px_rgba(15,23,42,0.14)]"
          style={{ visibility: "hidden" }}
          onPointerEnter={cancelClose}
          onPointerLeave={leave}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          {body}
        </span>,
        document.body,
      ) : null}
    </>
  );
}
