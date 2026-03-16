"use client";

import { useEffect, useRef } from "react";
import { adminToast } from "./admin-toast";

type AdminToastTriggerProps = {
  success?: string | null;
  error?: string | null;
  trigger?: string | number | null;
  clearParam?: string;
};

export function AdminToastTrigger({
  success,
  error,
  trigger,
  clearParam,
}: AdminToastTriggerProps) {
  const lastSuccessKey = useRef<string | null>(null);
  const lastErrorKey = useRef<string | null>(null);

  useEffect(() => {
    if (!success) return;

    const key = `${trigger ?? ""}::${success}`;
    if (lastSuccessKey.current === key) return;

    lastSuccessKey.current = key;
    adminToast.success(success);

    if (clearParam && typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete(clearParam);
      window.history.replaceState({}, "", url.toString());
    }
  }, [success, trigger, clearParam]);

  useEffect(() => {
    if (!error) return;

    const key = `${trigger ?? ""}::${error}`;
    if (lastErrorKey.current === key) return;

    lastErrorKey.current = key;
    adminToast.error(error);

    if (clearParam && typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete(clearParam);
      window.history.replaceState({}, "", url.toString());
    }
  }, [error, trigger, clearParam]);

  return null;
}