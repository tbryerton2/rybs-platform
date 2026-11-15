"use client";

import { useActionState, useState } from "react";
import { FormSubmitButton } from "@/app/admin/_components/admin/form-submit-button";
import type { PricingPageSettings } from "@/lib/pricing-page-content";
import { updatePricingPageContentAction } from "./actions";

const inputClass = "mt-2 w-full rounded-[4px] border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#F97316] focus:ring-4 focus:ring-orange-100";

function TextField({ name, label, helper, value, multiline = false }: {
  name: string; label: string; helper: string; value: string; multiline?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-900">{label}</span>
      <span className="mt-1 block text-xs leading-5 text-slate-500">{helper}</span>
      {multiline ? <textarea name={name} defaultValue={value} rows={3} className={inputClass} />
        : <input name={name} defaultValue={value} className={inputClass} />}
    </label>
  );
}

export function PricingPageContentForm({ settings }: { settings: PricingPageSettings }) {
  const [state, action] = useActionState(updatePricingPageContentAction, { success: false, message: "" });
  const [items, setItems] = useState(() => settings.includedItems.map((text, id) => ({ id, text })));
  const [nextId, setNextId] = useState(items.length);
  function move(index: number, offset: number) {
    setItems((current) => {
      const result = [...current];
      [result[index], result[index + offset]] = [result[index + offset], result[index]];
      return result;
    });
  }
  return (
    <section id="pricing-page-content" className="mt-8 scroll-mt-24">
      <h2 className="mb-4 text-xl font-semibold tracking-tight text-slate-950">Pricing page content</h2>
      <form action={action} className="space-y-5 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <TextField name="headline" label="Page headline" value={settings.headline} helper="Shown at the top of the Pricing page on the booking site." />
        <TextField name="introduction" label="Page introduction" value={settings.introduction} helper="Shown beneath the headline before a delivery ZIP is selected on the booking site." multiline />
        <TextField name="includedHeading" label="Included heading" value={settings.includedHeading} helper="Shown below the product cards, above the included items on the booking site." />
        <fieldset>
          <legend className="text-sm font-medium text-slate-900">Included items</legend>
          <p className="mt-1 text-xs leading-5 text-slate-500">Shown as a list below the product cards on the booking site. Use Up and Down to change the order.</p>
          <div className="mt-2 space-y-2">
            {items.map((item, index) => (
              <div key={item.id} className="flex flex-wrap items-center gap-2">
                <input name="includedItems" aria-label={`Included item ${index + 1}`} value={item.text}
                  onChange={(event) => setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, text: event.target.value } : entry))}
                  className={`${inputClass} mt-0 min-w-48 flex-1`} />
                <button type="button" className="admin-btn admin-btn-secondary" aria-label={`Move item ${index + 1} up`} disabled={index === 0} onClick={() => move(index, -1)}>Up</button>
                <button type="button" className="admin-btn admin-btn-secondary" aria-label={`Move item ${index + 1} down`} disabled={index === items.length - 1} onClick={() => move(index, 1)}>Down</button>
                <button type="button" className="admin-btn admin-btn-secondary" aria-label={`Remove item ${index + 1}`} onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))}>Remove</button>
              </div>
            ))}
          </div>
          <button type="button" className="admin-btn admin-btn-secondary mt-3" onClick={() => { setItems((current) => [...current, { id: nextId, text: "" }]); setNextId(nextId + 1); }}>Add item</button>
        </fieldset>
        <TextField name="bottomNote" label="Bottom note" value={settings.bottomNote} helper="Shown beneath the included items, below the product cards on the booking site." multiline />
        <label className="block">
          <span className="flex items-center gap-2 text-sm font-medium text-slate-900">
            <input type="checkbox" name="showSizeGuide" defaultChecked={settings.sizeGuide.enabled} className="h-4 w-4 rounded border-slate-300 text-[#F97316] focus:ring-orange-200" />
            Show size guide
          </span>
          <span className="mt-1 block text-xs leading-5 text-slate-500">Shows the size guide button above the pricing cards on the booking site when public products have guide details.</span>
        </label>
        <TextField name="sizeGuideButtonText" label="Size guide button text" value={settings.sizeGuide.buttonText} helper="Shown on the size guide button above the pricing cards on the booking site." />
        <TextField name="sizeGuideTitle" label="Size guide title" value={settings.sizeGuide.title} helper="Shown at the top of the guide opened from above the pricing cards on the booking site." />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-slate-500">Changes go live on the booking site when saved.</p>
          <FormSubmitButton>Save pricing page content</FormSubmitButton>
        </div>
        {state.message ? <p role="status" className={state.success ? "text-sm text-slate-600" : "text-sm text-red-700"}>{state.message}</p> : null}
      </form>
    </section>
  );
}
