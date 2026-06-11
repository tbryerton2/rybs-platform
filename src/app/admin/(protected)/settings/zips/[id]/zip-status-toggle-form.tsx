"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { adminToast } from "@/app/admin/_components/admin/admin-toast";
import {
  toggleZipActiveAction,
  type ZipToggleState,
} from "./actions";

const initialState: ZipToggleState = {
  success: false,
  message: "",
  messageKey: 0,
};

type ZipStatusToggleFormProps = {
  id: number;
  initialActive: boolean;
};

export function ZipStatusToggleForm({
  id,
  initialActive,
}: ZipStatusToggleFormProps) {
  const router = useRouter();
  const [active, setActive] = useState(initialActive);
  const [state, formAction, pending] = useActionState(
    toggleZipActiveAction,
    initialState,
  );

  useEffect(() => {
    setActive(initialActive);
  }, [initialActive]);

  useEffect(() => {
    if (state.error) {
      adminToast.error(state.error);
      return;
    }

    if (state.success) {
      if (typeof state.active === "boolean") {
        setActive(state.active);
      }

      if (state.message) {
        adminToast.success(state.message);
      }

      router.refresh();
    }
  }, [router, state]);

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <input
        type="hidden"
        name="nextActive"
        value={active ? "false" : "true"}
      />
      <button
        type="submit"
        disabled={pending}
        className={
          active
            ? "inline-flex h-10 items-center justify-center rounded-2xl border border-slate-900 bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            : "inline-flex h-10 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
        }
      >
        {pending ? (active ? "Deactivating..." : "Activating...") : active ? "Deactivate" : "Activate"}
      </button>
    </form>
  );
}
