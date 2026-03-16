"use client";

import { useEffect, useState } from "react";

type FadingFormMessageProps = {
  type: "success" | "error";
  message: string;
};

export function FadingFormMessage({
  type,
  message,
}: FadingFormMessageProps) {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!message) {
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
  }, [message]);

  if (!mounted) return null;

  const styles =
    type === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border-red-200 bg-red-50 text-red-800";

  return (
    <div
      className={[
        "mb-5 rounded-2xl border px-4 py-3 text-sm font-medium",
        "transition-all duration-500 ease-out",
        visible ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0",
        styles,
      ].join(" ")}
    >
      {message}
    </div>
  );
}