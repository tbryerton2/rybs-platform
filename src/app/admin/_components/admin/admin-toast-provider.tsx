"use client";

import { Toaster } from "sonner";

export function AdminToastProvider() {
  return (
    <Toaster
      position="top-right"
      richColors
      closeButton
      toastOptions={{
        duration: 3000,
      }}
    />
  );
}