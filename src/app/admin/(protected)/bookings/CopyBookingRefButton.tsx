"use client";

import { useState } from "react";
import { ClipboardDocumentIcon } from "@heroicons/react/24/outline";

export function CopyBookingRefButton({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="admin-btn admin-btn-secondary admin-btn-icon admin-btn-sm"
      aria-label={label}
      title={copied ? "Copied" : label}
    >
      <ClipboardDocumentIcon className="h-4 w-4" />
    </button>
  );
}
