"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addServiceZipAction, type AddZipFormState } from "./actions";
import { adminToast } from "@/app/admin/_components/admin/admin-toast";

const initialState: AddZipFormState = {
  error: null,
  createdZipId: null,
  createdZip: null,
  messageKey: 0,
};

function sanitizeZip(value: string) {
  return value.replace(/\D/g, "").slice(0, 5);
}

export function AddZipForm({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    addServiceZipAction,
    initialState,
  );

  useEffect(() => {
    if (state.error) {
      adminToast.error(state.error);
    }
  }, [state.error, state.messageKey]);

  useEffect(() => {
    if (!state.createdZipId || !state.createdZip) return;

    router.refresh();
  }, [router, state.createdZip, state.createdZipId, state.messageKey]);

  function updateZip(input: HTMLInputElement) {
    input.value = sanitizeZip(input.value);
  }

  function handlePaste(event: React.ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();

    const pasted = sanitizeZip(event.clipboardData.getData("text"));
    const input = event.currentTarget;
    const currentZip = input.value;
    const selectionStart = input.selectionStart ?? currentZip.length;
    const selectionEnd = input.selectionEnd ?? currentZip.length;
    const nextValue = sanitizeZip(
      `${currentZip.slice(0, selectionStart)}${pasted}${currentZip.slice(selectionEnd)}`,
    );

    input.value = nextValue;
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    const allowedKeys = new Set([
      "Backspace",
      "Delete",
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "Tab",
      "Home",
      "End",
      "Enter",
    ]);

    if (
      allowedKeys.has(event.key) ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey
    ) {
      return;
    }

    if (!/^\d$/.test(event.key)) {
      event.preventDefault();
    }
  }

  function handleBeforeInput(event: React.FormEvent<HTMLInputElement>) {
    const nativeEvent = event.nativeEvent as InputEvent;
    if (nativeEvent.data && /\D/.test(nativeEvent.data)) {
      nativeEvent.preventDefault();
    }
  }

  const setupHref = state.createdZipId ? `/admin/settings/zips/${state.createdZipId}` : null;

  return (
    <form
      action={formAction}
      className={compact ? "w-full max-w-full space-y-3" : "space-y-3"}
    >
      <div
        className={
          compact
            ? "flex w-full flex-wrap items-center justify-end gap-3"
            : "flex flex-col gap-3 sm:flex-row sm:items-end"
        }
      >
        <div className={compact ? "w-full min-w-0 sm:w-auto sm:flex-1 sm:max-w-xs" : "sm:max-w-xs sm:flex-1"}>
          <label
            htmlFor="zip"
            className={compact ? "sr-only" : "mb-2 block text-sm font-medium text-slate-700"}
          >
            ZIP code
          </label>
          <input
            key={state.createdZipId ? state.messageKey : "zip-input"}
            id="zip"
            name="zip"
            type="text"
            onChange={(event) => updateZip(event.currentTarget)}
            onPaste={handlePaste}
            onKeyDown={handleKeyDown}
            onBeforeInput={handleBeforeInput}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={5}
            placeholder="13421"
            autoComplete="postal-code"
            className="h-12 w-full min-w-0 rounded-[14px] border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#F97316]"
            required
            aria-invalid={state.error ? true : false}
            aria-describedby={state.error ? "zip-error" : undefined}
          />
        </div>

        <div className="shrink-0">
          <button
            type="submit"
            disabled={pending}
            className="admin-btn admin-btn-primary h-12 px-5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Adding..." : "Add ZIP"}
          </button>
        </div>
      </div>

      {setupHref && state.createdZip ? (
        <div className="rounded-[14px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="leading-6">
              <span className="font-semibold">ZIP {state.createdZip} was added successfully.</span>{" "}
              Set it up now to add state, town, county, and pricing details.
            </p>
            <Link
              href={setupHref}
              className="admin-btn admin-btn-secondary h-10 shrink-0 px-4"
            >
              Set up ZIP
            </Link>
          </div>
        </div>
      ) : null}
    </form>
  );
}
