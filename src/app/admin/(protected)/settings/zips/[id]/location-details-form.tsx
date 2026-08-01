"use client";

import { useActionState, useEffect } from "react";
import {
  updateZipLocationAction,
  type ZipFormState,
} from "./actions";
import { FadingFormMessage } from "@/app/admin/_components/admin/fading-form-message";
import { FormSubmitButton } from "@/app/admin/_components/admin/form-submit-button";
import { adminToast } from "@/app/admin/_components/admin/admin-toast";


type Props = {
  id: number;
  town: string | null;
  county: string | null;
  stateCode: string | null;
};

const initialState: ZipFormState = {
  success: false,
  message: "",
  messageKey: 0,
};

export function LocationDetailsForm({ id, town, county, stateCode }: Props) {
  const [state, formAction] = useActionState(updateZipLocationAction, initialState);
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

        <div className="grid gap-5 sm:grid-cols-3">
          <label className="block">
            <div className="mb-2 text-sm font-medium text-slate-700">Town</div>
            <input
              type="text"
              name="town"
              defaultValue={town ?? ""}
              placeholder="Enter town"
              className="w-full rounded-[14px] border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#F97316] focus:ring-4 focus:ring-orange-100"
            />
          </label>

          <label className="block">
            <div className="mb-2 text-sm font-medium text-slate-700">County</div>
            <input
              type="text"
              name="county"
              defaultValue={county ?? ""}
              placeholder="Enter county"
              className="w-full rounded-[14px] border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#F97316] focus:ring-4 focus:ring-orange-100"
            />
          </label>

          <label className="block">
            <div className="mb-2 text-sm font-medium text-slate-700">State</div>
            <input
              type="text"
              name="state"
              defaultValue={stateCode ?? ""}
              placeholder="NY"
              maxLength={2}
              onInput={(event) => {
                event.currentTarget.value = event.currentTarget.value.trim().toUpperCase();
              }}
              className="w-full rounded-[14px] border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#F97316] focus:ring-4 focus:ring-orange-100"
            />
            {state.fieldErrors?.state ? (
              <div className="mt-2 text-sm text-red-700">{state.fieldErrors.state}</div>
            ) : null}
          </label>
        </div>

        <div className="mt-5">
          <FormSubmitButton>Save location details</FormSubmitButton>
        </div>
      </form>
    </>
  );
}
