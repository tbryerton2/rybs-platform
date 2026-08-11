"use client";

import { useActionState } from "react";
import Link from "next/link";
import { FormSubmitButton } from "@/app/admin/_components/admin/form-submit-button";
import { updateBusinessAction } from "../../actions";
import {
  getInitialPlatformBusinessFormState,
  type PlatformBusinessFormState,
} from "../../form-state";

type EditBusinessFormProps = {
  tenantId: string;
  businessName: string;
  slug: string;
  status: string;
  updatedAt: string | null;
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-2 text-sm font-medium text-red-600">{message}</p>;
}

export function EditBusinessForm({
  tenantId,
  businessName,
  slug,
  status,
  updatedAt,
}: EditBusinessFormProps) {
  const initialState: PlatformBusinessFormState = getInitialPlatformBusinessFormState({
    businessName,
    slug,
    status,
  });
  const [state, formAction] = useActionState(updateBusinessAction, initialState);

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="expectedUpdatedAt" value={updatedAt ?? ""} />
      <input type="hidden" name="status" value={status} />

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
        <div className="mt-3 rounded-[8px] border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-800">
          Changing the slug may affect future routing, storage naming, or integrations that depend on this business identifier.
        </div>
        <FieldError message={state.fieldErrors?.slug} />
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-5">
        <FormSubmitButton loadingLabel="Saving...">Save changes</FormSubmitButton>
        <Link href={`/platform-admin/businesses/${tenantId}`} className="admin-btn admin-btn-secondary">
          Cancel
        </Link>
      </div>
    </form>
  );
}
