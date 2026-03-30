"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type LoadingButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  loadingLabel?: string;
  spinner?: boolean;
  children: ReactNode;
};

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function LoadingButton({
  loading = false,
  loadingLabel,
  spinner = true,
  children,
  className,
  disabled,
  type = "button",
  ...props
}: LoadingButtonProps) {
  const effectiveDisabled = disabled || loading;

  return (
    <button
      type={type}
      disabled={effectiveDisabled}
      aria-busy={loading || undefined}
      className={joinClasses(
        "transition active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316]/30 focus-visible:ring-offset-2",
        className,
        effectiveDisabled && "disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100",
      )}
      {...props}
    >
      <span className="inline-flex items-center justify-center gap-2">
        {loading && spinner ? (
          <svg
            aria-hidden="true"
            className="h-4 w-4 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle cx="12" cy="12" r="9" className="opacity-25" stroke="currentColor" strokeWidth="3" />
            <path d="M21 12a9 9 0 0 0-9-9" className="opacity-90" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        ) : null}
        <span>{loading ? loadingLabel ?? children : children}</span>
      </span>
    </button>
  );
}
