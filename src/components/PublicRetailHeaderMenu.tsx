"use client";

import Link from "next/link";
import { Bars3Icon, EnvelopeIcon, PhoneIcon, UserCircleIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useEffect, useId, useRef, useState } from "react";

type PublicRetailHeaderMenuProps = {
  emailHref: string | null;
  emailLabel: string | null;
  phoneHref: string | null;
  phoneLabel: string | null;
};

function menuItemClasses() {
  return "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316]/40";
}

export function PublicRetailHeaderMenu({
  emailHref,
  emailLabel,
  phoneHref,
  phoneLabel,
}: PublicRetailHeaderMenuProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;

      setOpen(false);
      buttonRef.current?.focus();
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target)) return;

      setOpen(false);
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative ml-4 md:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={open ? "Close site menu" : "Open site menu"}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white/80 text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-white hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316]/40 focus-visible:ring-offset-2"
      >
        {open ? <XMarkIcon className="h-5 w-5" aria-hidden="true" /> : <Bars3Icon className="h-5 w-5" aria-hidden="true" />}
      </button>

      {open ? (
        <div
          id={menuId}
          className="absolute right-0 top-full z-50 mt-2 w-[min(calc(100vw-3rem),20rem)] rounded-[18px] border border-slate-200 bg-white p-2 shadow-[0_18px_45px_rgba(15,23,42,0.18)]"
        >
          <nav aria-label="Public site menu" className="space-y-1">
            <Link href="/portal" onClick={() => setOpen(false)} className={menuItemClasses()}>
              <UserCircleIcon className="h-5 w-5 shrink-0 text-[#F97316]" aria-hidden="true" />
              <span>Customer Portal</span>
            </Link>

            {emailHref && emailLabel ? (
              <a href={emailHref} onClick={() => setOpen(false)} className={menuItemClasses()}>
                <EnvelopeIcon className="h-5 w-5 shrink-0 text-[#F97316]" aria-hidden="true" />
                <span className="min-w-0 truncate">{emailLabel}</span>
              </a>
            ) : null}

            {phoneHref && phoneLabel ? (
              <a href={phoneHref} onClick={() => setOpen(false)} className={menuItemClasses()}>
                <PhoneIcon className="h-5 w-5 shrink-0 text-[#F97316]" aria-hidden="true" />
                <span>{phoneLabel}</span>
              </a>
            ) : null}
          </nav>
        </div>
      ) : null}
    </div>
  );
}
