"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { LoadingButton } from "@/components/ui/loading-button";

type FormSubmitButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  loadingLabel?: string;
  pendingText?: string;
};

const defaultClassName =
  "inline-flex items-center rounded-2xl bg-[#F97316] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-60";

export function FormSubmitButton({
  children,
  className = defaultClassName,
  disabled,
  loadingLabel = "Saving...",
  pendingText,
  ...props
}: FormSubmitButtonProps) {
  const { pending } = useFormStatus();
  const effectiveDisabled = disabled || pending;

  return (
    <LoadingButton
      {...props}
      type="submit"
      disabled={effectiveDisabled}
      loading={pending}
      loadingLabel={pendingText ?? loadingLabel}
      className={className}
      aria-disabled={effectiveDisabled}
    >
      {children}
    </LoadingButton>
  );
}
