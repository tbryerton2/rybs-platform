"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";

type FlashSuccessProps = {
  show: boolean;
  message?: string;
  children?: ReactNode;
};

export function FlashSuccess({ show, message, children }: FlashSuccessProps) {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!show) {
      setVisible(false);
      setMounted(false);
      return;
    }

    setMounted(true);

    const enterTimer = window.setTimeout(() => {
      setVisible(true);
    }, 10);

    const fadeTimer = window.setTimeout(() => {
      setVisible(false);
    }, 2600);

    const removeTimer = window.setTimeout(() => {
      setMounted(false);
    }, 3200);

    return () => {
      window.clearTimeout(enterTimer);
      window.clearTimeout(fadeTimer);
      window.clearTimeout(removeTimer);
    };
  }, [show]);

  if (!mounted) return null;

  return (
    <div
      className={[
        "mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800",
        "transition-all duration-500 ease-out",
        visible ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0",
      ].join(" ")}
    >
      {children ?? message}
    </div>
  );
}