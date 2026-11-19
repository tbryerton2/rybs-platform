"use client";

import Link from "next/link";
import { ArrowsRightLeftIcon, Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";
import { useCallback, useEffect, useRef, useState } from "react";
import { AdminNavigation } from "./admin-navigation";
import styles from "./admin-mobile-nav.module.css";

// Match Tailwind's xl breakpoint used by the sidebar and content offset.
// Below 80rem the expanded sidebar leaves too little room for admin tables/forms.
const SIDEBAR_MEDIA_QUERY = "(min-width: 80rem)";

export function AdminMobileNav({
  pathname,
  businessName,
  canSwitchBusiness,
}: {
  pathname: string;
  businessName: string;
  canSwitchBusiness: boolean;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const backdropPointerDown = useRef(false);

  const close = useCallback(() => {
    dialogRef.current?.close();
    setOpen(false);
  }, []);

  // Also close for browser Back/Forward or navigation initiated outside the drawer.
  useEffect(() => {
    dialogRef.current?.close();
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const sidebarMedia = window.matchMedia(SIDEBAR_MEDIA_QUERY);
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    // Native modality makes the rest of the page inert, including the main header.
    dialog.showModal();
    // A resize can happen between the opening click and this effect.
    if (sidebarMedia.matches) {
      dialog.close();
      return;
    }

    const trigger = triggerRef.current;
    const body = document.body;
    const root = document.documentElement;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      width: body.style.width,
      overflow: body.style.overflow,
      rootOverflow: root.style.overflow,
    };

    // Fix the body as well as hiding overflow to lock scrolling on iOS Safari.
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = `-${scrollX}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";
    root.style.overflow = "hidden";

    closeButtonRef.current?.focus();

    function onResize(event: MediaQueryListEvent) {
      if (event.matches) close();
    }
    sidebarMedia.addEventListener("change", onResize);

    return () => {
      sidebarMedia.removeEventListener("change", onResize);
      dialog.close();
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.left = previous.left;
      body.style.width = previous.width;
      body.style.overflow = previous.overflow;
      root.style.overflow = previous.rootOverflow;
      window.scrollTo({ left: scrollX, top: scrollY, behavior: "instant" });

      if (trigger?.isConnected && trigger.getClientRects().length) {
        trigger.focus({ preventScroll: true });
      } else if (sidebarMedia.matches) {
        // The hamburger is hidden after rotation to the persistent sidebar.
        document.querySelector<HTMLElement>('#admin-sidebar [aria-current="page"]')?.focus({ preventScroll: true });
      }
    };
  }, [open, close]);

  return (
    <>
      <div className="border-b border-slate-200 bg-white xl:hidden">
        <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open admin navigation"
            aria-expanded={open}
            aria-controls="admin-navigation-drawer"
            aria-haspopup="dialog"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
          >
            <Bars3Icon className="h-5 w-5" aria-hidden="true" />
          </button>
          <p className="min-w-0 flex-1 break-words text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
            {businessName}
          </p>
          {canSwitchBusiness ? (
            <Link
              href="/admin/select-business"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
              aria-label="Switch business"
              title="Switch business"
            >
              <ArrowsRightLeftIcon className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      </div>

      <dialog
        ref={dialogRef}
        id="admin-navigation-drawer"
        aria-labelledby="admin-navigation-title"
        className={styles.drawer}
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClose={() => {
          if (!dialogRef.current?.open) setOpen(false);
        }}
        onPointerDown={(event) => {
          backdropPointerDown.current = event.target === event.currentTarget;
        }}
        onClick={(event) => {
          if (backdropPointerDown.current && event.target === event.currentTarget) close();
        }}
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const items = event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]');
          const first = items[0];
          const last = items[items.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
      >
        <div className={styles.panel}>
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <h2 id="admin-navigation-title" className="text-base font-semibold text-slate-900">
              Navigation
            </h2>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={close}
              aria-label="Close admin navigation"
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
            >
              <XMarkIcon className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <AdminNavigation pathname={pathname} onNavigate={close} />
        </div>
      </dialog>
    </>
  );
}
