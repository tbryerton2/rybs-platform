"use client";

import { useFormStatus } from "react-dom";
import { LoadingButton } from "@/components/ui/loading-button";

type FormSubmitButtonProps = {
  children: React.ReactNode;
};

export function FormSubmitButton({ children }: FormSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <LoadingButton
      type="submit"
      loading={pending}
      loadingLabel="Saving..."
      className="inline-flex items-center rounded-2xl bg-[#F97316] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </LoadingButton>
  );
}
