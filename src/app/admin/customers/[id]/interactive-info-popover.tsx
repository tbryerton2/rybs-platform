"use client";

import { InformationCircleIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type InteractiveInfoPopoverProps = {
  label: string;
  title?: string;
  body: string;
  learnMoreHref?: string;
};

export function InteractiveInfoPopover({
  label,
  title,
  body,
  learnMoreHref,
}: InteractiveInfoPopoverProps) {
  const [open, setOpen] = useState(false);
  const closeTimeoutRef = useRef<number | null>(null);

  function clearCloseTimeout() {
    if (closeTimeoutRef.current != null) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }

  function openPopover() {
    clearCloseTimeout();
    setOpen(true);
  }

  function scheduleClose() {
    clearCloseTimeout();
    closeTimeoutRef.current = window.setTimeout(() => {
      setOpen(false);
    }, 120);
  }

  useEffect(() => {
    return () => {
      clearCloseTimeout();
    };
  }, []);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={openPopover}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        className="rounded-full p-0.5 text-slate-400 transition hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/80 focus-visible:ring-offset-2"
        onFocus={openPopover}
        onBlur={scheduleClose}
      >
        <InformationCircleIcon className="h-4.5 w-4.5" aria-hidden="true" />
      </button>

      {open ? (
        <span
          role="dialog"
          aria-label={label}
          className="absolute left-0 top-7 z-50 w-72 rounded-2xl border border-slate-200/90 bg-white px-3.5 py-3 text-left text-xs font-medium leading-5 text-slate-600 shadow-[0_16px_36px_rgba(15,23,42,0.14)]"
          onMouseEnter={openPopover}
          onMouseLeave={scheduleClose}
        >
          {title ? (
            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              {title}
            </span>
          ) : null}
          <span className="block">{body}</span>
          {learnMoreHref ? (
            <Link
              href={learnMoreHref}
              className="mt-2 inline-flex text-xs font-semibold text-[#F97316] hover:text-orange-600"
            >
              Learn more
            </Link>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
