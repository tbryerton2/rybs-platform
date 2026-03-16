"use client";

import { useActionState, useEffect } from "react";
import {
  updateZipPricingAction,
  type ZipFormState,
} from "./actions";
import { FadingFormMessage } from "@/app/admin/_components/admin/fading-form-message";
import { FormSubmitButton } from "@/app/admin/_components/admin/form-submit-button";
import { adminToast } from "@/app/admin/_components/admin/admin-toast";

type Props = {
  id: number;
  price_14_yard_override: number | null;
};

const initialState: ZipFormState = {
  success: false,
  message: "",
  messageKey: 0,
};

export function PricingOverrideForm({
  id,
  price_14_yard_override,
}: Props) {
  const [state, formAction] = useActionState(updateZipPricingAction, initialState);

  useEffect(() => {
    if (state.success && state.message) {
      adminToast.success(state.message);
    }
  }, [state.success, state.message, state.messageKey]);

  return (
    <>
      <div className="px-6 pt-6">
        <FadingFormMessage
          key={`error-${state.messageKey}`}
          type="error"
          message={state.error ?? ""}
        />
      </div>

      <form action={formAction} className="px-6 pb-6">
        <input type="hidden" name="id" value={id} />

        <label className="block">
          <div className="mb-2 text-sm font-medium text-slate-700">
            14-yard price override
          </div>

          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-400">
              $
            </span>
            <input
              type="number"
              name="price_14_yard_override"
              inputMode="numeric"
              min="0"
              step="1"
              defaultValue={price_14_yard_override ?? ""}
              placeholder="Leave blank to use default"
              className="w-full rounded-2xl border border-slate-300 bg-white py-3 pl-8 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#F97316] focus:ring-4 focus:ring-orange-100"
            />
          </div>
        </label>

        <div className="mt-5">
          <FormSubmitButton>Save pricing override</FormSubmitButton>
        </div>
      </form>
    </>
  );
}