"use client";

import { useActionState, useEffect } from "react";
import { addServiceZipAction, type AddZipFormState } from "./actions";
import { adminToast } from "@/app/admin/_components/admin/admin-toast";

const initialState: AddZipFormState = {
  error: null,
  messageKey: 0,
};

export function AddZipForm() {
  const [state, formAction, pending] = useActionState(
    addServiceZipAction,
    initialState,
  );

  useEffect(() => {
    if (state.error) {
      adminToast.error(state.error);
    }
  }, [state.error, state.messageKey]);

  return (
    <form action={formAction} className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="sm:max-w-xs sm:flex-1">
          <label htmlFor="zip" className="mb-2 block text-sm font-medium text-slate-700">
            ZIP code
          </label>
          <input
            id="zip"
            name="zip"
            inputMode="numeric"
            pattern="[0-9]{5}"
            maxLength={5}
            placeholder="13421"
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#F97316]"
            required
            aria-invalid={state.error ? true : false}
            aria-describedby={state.error ? "zip-error" : undefined}
          />
        </div>

        <div className="sm:shrink-0">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-12 items-center justify-center rounded-2xl bg-[#F97316] px-5 text-sm font-medium text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Adding..." : "Add ZIP"}
          </button>
        </div>
      </div>  
    </form>
  );
}