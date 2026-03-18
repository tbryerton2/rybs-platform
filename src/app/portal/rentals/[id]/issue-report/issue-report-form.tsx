"use client";

import { ISSUE_REPORT_DESCRIPTION_MAX_LENGTH } from "@/lib/rental-action-requests";

type IssueCategoryOption =
  | ""
  | "delivery_issue"
  | "pickup_issue"
  | "placement_problem"
  | "damage_concern"
  | "billing_question"
  | "usage_question"
  | "other";

type IssueUrgencyOption = "" | "standard" | "urgent_today";
type PreferredContactOption = "" | "phone" | "email";

type IssueReportFormProps = {
  bookingId: string;
  defaultIssueCategory: IssueCategoryOption;
  defaultUrgency: IssueUrgencyOption;
  defaultDescription: string;
  defaultPreferredContactMethod: PreferredContactOption;
  action: (formData: FormData) => void | Promise<void>;
};

export function IssueReportForm({
  bookingId,
  defaultIssueCategory,
  defaultUrgency,
  defaultDescription,
  defaultPreferredContactMethod,
  action,
}: IssueReportFormProps) {
  return (
    <form action={action} className="mt-8 space-y-6">
      <input type="hidden" name="booking_id" value={bookingId} />
      <input type="hidden" name="step" value="review" />

      <div>
        <label htmlFor="issue_category" className="text-sm font-semibold text-slate-900">
          Issue type
        </label>
        <select
          id="issue_category"
          name="issue_category"
          defaultValue={defaultIssueCategory}
          className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400 focus:bg-white"
        >
          <option value="">Select an issue</option>
          <option value="delivery_issue">Delivery issue</option>
          <option value="pickup_issue">Pickup issue</option>
          <option value="placement_problem">Placement problem</option>
          <option value="damage_concern">Damage concern</option>
          <option value="billing_question">Billing question</option>
          <option value="usage_question">Usage question</option>
          <option value="other">Other</option>
        </select>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-slate-900">Urgency</legend>
        <label className="flex items-start gap-3 rounded-2xl border border-slate-200 px-4 py-4">
          <input
            type="radio"
            name="urgency"
            value="standard"
            defaultChecked={defaultUrgency === "standard"}
            className="mt-1"
          />
          <span>
            <span className="block text-sm font-semibold text-slate-900">Standard</span>
            <span className="mt-1 block text-sm text-slate-500">
              This can be reviewed during normal business operations.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-3 rounded-2xl border border-slate-200 px-4 py-4">
          <input
            type="radio"
            name="urgency"
            value="urgent_today"
            defaultChecked={defaultUrgency === "urgent_today"}
            className="mt-1"
          />
          <span>
            <span className="block text-sm font-semibold text-slate-900">Need help today</span>
            <span className="mt-1 block text-sm text-slate-500">
              Use this if the issue is time-sensitive and affecting the current rental.
            </span>
          </span>
        </label>
      </fieldset>

      <div>
        <label htmlFor="description" className="text-sm font-semibold text-slate-900">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={5}
          maxLength={ISSUE_REPORT_DESCRIPTION_MAX_LENGTH}
          defaultValue={defaultDescription}
          placeholder="Describe what happened and what help you need."
          className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400 focus:bg-white"
        />
        <div className="mt-2 text-xs text-slate-500">
          Required. Up to {ISSUE_REPORT_DESCRIPTION_MAX_LENGTH} characters.
        </div>
      </div>

      <div>
        <label htmlFor="preferred_contact_method" className="text-sm font-semibold text-slate-900">
          Preferred contact method
        </label>
        <select
          id="preferred_contact_method"
          name="preferred_contact_method"
          defaultValue={defaultPreferredContactMethod}
          className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400 focus:bg-white"
        >
          <option value="">No preference</option>
          <option value="phone">Phone</option>
          <option value="email">Email</option>
        </select>
      </div>

      <button
        type="submit"
        className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
      >
        Review issue report
      </button>
    </form>
  );
}
