"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function BookOnlineButton({
  zip,
  zipValid,
}: {
  zip: string;
  zipValid: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <button
      onClick={() => {
        if (loading) return;
        setLoading(true);
        router.push(zipValid ? `/book/address?zip=${zip}` : "/address");
      }}
      disabled={loading}
      className="mt-8 inline-flex h-12 w-full items-center justify-center rounded-2xl bg-[#F97316] px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-[#EA580C] active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed"
    >
      {loading ? "Loading..." : "Book Online"}
    </button>
  );
}