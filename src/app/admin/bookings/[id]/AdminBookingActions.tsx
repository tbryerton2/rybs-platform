"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  bookingId: string;
  currentStatus?: string | null;
};

export default function AdminBookingActions({ bookingId, currentStatus }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState<null | string>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // ✅ NEW: note field
  const [note, setNote] = useState("");

  async function setStatus(status: string) {
    try {
      if (!bookingId || typeof bookingId !== "string") {
        setError("Missing booking ID");
        setSaving(null);
        return;
      }

      setSuccess(null);

      if (status === "cancelled" && !confirm("Cancel this booking?")) return;

      setError(null);
      setSaving(status);

      const url = `/api/admin/bookings/${encodeURIComponent(bookingId)}`;

      const res = await fetch(url, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.NEXT_PUBLIC_ADMIN_TOKEN
            ? { "x-admin-token": process.env.NEXT_PUBLIC_ADMIN_TOKEN }
            : {}),
        },
        // ✅ NEW: send note too
        body: JSON.stringify({ status, note: note.trim() || null }),
      });

      const json = await res.json();

      if (!res.ok || !json?.ok) {
        setError(json?.error || "Update failed");
        setSaving(null);
        return;
      }
      /*if (!res.ok || !json?.ok) {
        setError(JSON.stringify(json));
        setSaving(null);
        return;
      }*/



      router.refresh();
    //setSuccess(JSON.stringify(json));
      setSuccess("Saved ✅");
      setSaving(null);

      // ✅ NEW: clear note after save
      setNote("");
    } catch (e: any) {
      setError(e?.message || "Update failed");
      setSaving(null);
    }
  }

  const disabled = saving !== null;

  return (
    <section className="rounded-lg border p-4 space-y-3">
      <div className="font-medium text-sm">Admin actions</div>

      <div className="text-sm text-muted-foreground">
        Current status: <span className="font-mono">{currentStatus ?? "—"}</span>
      </div>

      {/* ✅ NEW: Note input */}
      <div className="grid gap-1">
        <label className="text-sm font-medium">Note (optional)</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g., Customer requested pickup on Friday"
          className="w-full rounded-md border px-3 py-2 text-sm"
          rows={3}
          disabled={disabled}
        />
      </div>

      {error && (
        <div className="rounded-md border p-3 text-sm">❌ {error}</div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-md border px-4 py-2"
          disabled={disabled}
          onClick={() => setStatus("confirmed")}
        >
          {saving === "confirmed" ? "Saving..." : "Mark confirmed"}
        </button>

        <button
          type="button"
          className="rounded-md border px-4 py-2"
          disabled={disabled}
          onClick={() => setStatus("scheduled")}
        >
          {saving === "scheduled" ? "Saving..." : "Mark scheduled"}
        </button>

        <button
          type="button"
          className="rounded-md border px-4 py-2"
          disabled={disabled}
          onClick={() => setStatus("cancelled")}
        >
          {saving === "cancelled" ? "Saving..." : "Cancel"}
        </button>
      </div>

      {success && <div className="rounded-md border p-3 text-sm">{success}</div>}
    </section>
  );
}