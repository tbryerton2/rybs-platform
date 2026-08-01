"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { LoadingButton } from "@/components/ui/loading-button";
import { adminButtonClassName } from "./admin-button";

type FormSubmitButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  loadingLabel?: string;
  pendingText?: string;
};

const defaultClassName =
  adminButtonClassName({ variant: "primary" });

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
