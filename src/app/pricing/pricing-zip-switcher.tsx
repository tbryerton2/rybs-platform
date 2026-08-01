"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LoadingButton } from "@/components/ui/loading-button";

type LookupState =
  | { status: "idle" }
  | { status: "invalid"; message: string }
  | { status: "not_serviced"; zip: string }
  | { status: "error"; message: string };

export default function PricingZipSwitcher({
  currentZip,
  preview,
}: {
  currentZip: string;
  preview?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [zip, setZip] = useState("");
  const [lookupState, setLookupState] = useState<LookupState>({ status: "idle" });
  const [loading, setLoading] = useState(false);
  const zipDigits = useMemo(() => zip.replace(/\D/g, "").slice(0, 5), [zip]);
  const zipValid = zipDigits.length === 5;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    if (!zipValid) {
      setLookupState({ status: "invalid", message: "Enter a valid 5-digit ZIP code." });
      return;
    }

    setLoading(true);
    setLookupState({ status: "idle" });

    try {
      const params = new URLSearchParams({ zip: zipDigits });
      const response = await fetch(`/api/zip-check?${params.toString()}`, { cache: "no-store" });
      const json = (await response.json().catch(() => null)) as Record<string, unknown> | null;

      if (json?.serviced === true) {
        const nextParams = new URLSearchParams({ zip: zipDigits });
        if (preview) nextParams.set("preview", "1");
        setOpen(false);
        setZip("");
        setLookupState({ status: "idle" });
        router.push(`/pricing?${nextParams.toString()}`);
        return;
      }

      if (response.ok || json?.serviced === false) {
        setLookupState({ status: "not_serviced", zip: zipDigits });
        return;
      }

      setLookupState({
        status: "error",
        message: "We could not check that ZIP right now. Please try again.",
      });
    } catch {
      setLookupState({
        status: "error",
        message: "We could not check that ZIP right now. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setZip("");
          setLookupState({ status: "idle" });
        }}
        className="whitespace-nowrap text-sm font-semibold text-[#F97316] underline decoration-orange-300 underline-offset-4 transition hover:text-[#EA580C]"
      >
        not your ZIP?
      </button>
    );
  }

  return (
    <div className="basis-full pt-1 text-sm">
      <div className="max-w-xl">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="sr-only" htmlFor="pricing-zip-switcher">
            Enter ZIP code
          </label>
          <input
            id="pricing-zip-switcher"
            inputMode="numeric"
            autoComplete="postal-code"
            value={zipDigits}
            onChange={(event) => {
              setZip(event.target.value);
              setLookupState({ status: "idle" });
            }}
            placeholder={currentZip || "Enter ZIP code"}
            className="h-11 w-full rounded-2xl border border-[#c0b9ae] bg-white px-4 text-[#0F172A] shadow-sm outline-none transition focus:ring-2 focus:ring-[#F97316]/40 sm:max-w-[180px]"
          />
          <div className="flex gap-2">
            <LoadingButton
              type="submit"
              loading={loading}
              loadingLabel="Checking..."
              disabled={!zipValid}
              className="h-11 rounded-2xl bg-[#F97316] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#EA580C] disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.99]"
            >
              Check ZIP
            </LoadingButton>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setZip("");
                setLookupState({ status: "idle" });
              }}
              className="h-11 rounded-2xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>

        <ZipLookupMessage state={lookupState} />
      </div>
    </div>
  );
}

function ZipLookupMessage({ state }: { state: LookupState }) {
  if (state.status === "idle") return null;

  if (state.status === "not_serviced") {
    return (
      <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950">
        Sorry, we do not currently serve {state.zip}.
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-950">
      {state.message}
    </div>
  );
}
