"use client";

import { toast } from "sonner";

export const adminToast = {
  success(message: string) {
    toast.success(message);
  },
  error(message: string) {
    toast.error(message);
  },
};