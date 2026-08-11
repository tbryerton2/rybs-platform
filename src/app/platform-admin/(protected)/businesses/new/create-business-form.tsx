"use client";

import { useActionState } from "react";
import Link from "next/link";
import { FormSubmitButton } from "@/app/admin/_components/admin/form-submit-button";
import { createBusinessAction } from "../actions";
import {
  getInitialPlatformBusinessFormState,
  type PlatformBusinessFormState,
} from "../form-state";

const initialState: PlatformBusinessFormState = getInitialPlatformBusinessFormState({
  businessName: "",
  slug: "",
  status: "inactive",
});

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-2 text-sm font-medium text-red-600">{message}</p>;
}

export function CreateBusinessForm() {
  const [state, formAction] = useActionState(createBusinessAction, initialState);

  return (
    <form action={formAction} className="space-y-6">
      {state.status === "error" && state.message ? (
        <div className="rounded-[8px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {state.message}
        </div>
      ) : null}

      <div>
        <label htmlFor="businessName" className="text-sm font-semibold text-slate-700">
          Business name
        </label>
        <input
          id="businessName"
          name="businessName"
          type="text"
          defaultValue={state.values.businessName}
          autoComplete="organization"
          className="mt-2 block h-11 w-full rounded-[8px] border border-slate-300 px-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
          required
        />
        <FieldError message={state.fieldErrors?.businessName} />
      </div>

      <div>
        <label htmlFor="slug" className="text-sm font-semibold text-slate-700">
          Slug
        </label>
        <input
          id="slug"
          name="slug"
          type="text"
          defaultValue={state.values.slug}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="mt-2 block h-11 w-full rounded-[8px] border border-slate-300 px-3 font-mono text-sm text-slate-900 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
          required
        />
        <p className="mt-2 text-xs text-slate-500">
          Lowercase letters, numbers, and hyphens only. Reserved platform slugs are blocked.
        </p>
        <FieldError message={state.fieldErrors?.slug} />
      </div>

      <fieldset>
        <legend className="text-sm font-semibold text-slate-700">Initial status</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="flex cursor-pointer items-start gap-3 rounded-[8px] border border-slate-200 bg-white p-3 ring-1 ring-transparent has-[:checked]:border-sky-400 has-[:checked]:ring-sky-100">
            <input
              type="radio"
              name="status"
              value="inactive"
              defaultChecked={state.values.status !== "active"}
              className="mt-1 h-4 w-4 border-slate-300 text-sky-600 focus:ring-sky-500"
            />
            <span>
              <span className="block text-sm font-semibold text-slate-900">Inactive</span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">
                Safest default until setup is complete.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-[8px] border border-slate-200 bg-white p-3 ring-1 ring-transparent has-[:checked]:border-sky-400 has-[:checked]:ring-sky-100">
            <input
              type="radio"
              name="status"
              value="active"
              defaultChecked={state.values.status === "active"}
              className="mt-1 h-4 w-4 border-slate-300 text-sky-600 focus:ring-sky-500"
            />
            <span>
              <span className="block text-sm font-semibold text-slate-900">Active</span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">
                Allowed, but setup warnings will still show.
              </span>
            </span>
          </label>
        </div>
        <FieldError message={state.fieldErrors?.status} />
      </fieldset>

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-5">
        <FormSubmitButton loadingLabel="Creating...">Create business</FormSubmitButton>
        <Link href="/platform-admin/businesses" className="admin-btn admin-btn-secondary">
          Cancel
        </Link>
      </div>
    </form>
  );
}
