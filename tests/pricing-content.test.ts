import test from "node:test";
import assert from "node:assert/strict";
import { getProductSizeGuideRows } from "../src/lib/pricing-size-guide.ts";
import { cleanProductDescription } from "../src/lib/product-card-content.ts";
import { getPricingPageSettings } from "../src/lib/pricing-page-settings.ts";
import { readFileSync } from "node:fs";
import { supabaseAdmin } from "../src/lib/supabaseAdmin.ts";

const product = (id: string, order: number, estimate = "1-2 truck loads", examples = "Small cleanouts") => ({
  dumpsterProductId: id, dumpsterSize: `${id} yard`, displayName: `${id}-yard dumpster`,
  isPublic: true, sortOrder: order, truckLoadEstimate: estimate, sizeGuideExamples: examples,
});

test("retail guide uses public product details and display order without mutating input", () => {
  const products = [product("20", 10), product("10", 20), { ...product("30", 0), isPublic: false }, product("40", 1, "", "")];
  const rows = getProductSizeGuideRows(products);
  assert.deepEqual(rows.map((row) => row.sizeLabel), ["20 yard", "10 yard"]);
  assert.equal(rows[0].truckLoadEstimate, "1-2 truck loads");
  assert.equal(rows[0].description, "Small cleanouts");
  assert.deepEqual(products.map((item) => item.dumpsterProductId), ["20", "10", "30", "40"]);
});

test("either optional guide field can render a row; blank/private products hide the guide", () => {
  assert.equal(getProductSizeGuideRows([product("10", 0, "1 load", "")]).length, 1);
  assert.equal(getProductSizeGuideRows([product("10", 0, "", "Examples")]).length, 1);
  assert.deepEqual(getProductSizeGuideRows([product("10", 0, "  ", "\n")]), []);
  assert.deepEqual(getProductSizeGuideRows([{ ...product("10", 0), isPublic: false }]), []);
});

test("only the exact seeded description is cleared", () => {
  assert.equal(cleanProductDescription("Draft defaults based on the current global pricing fallback."), "");
  assert.equal(cleanProductDescription("Draft defaults based on the current global pricing fallback. Edited"), "Draft defaults based on the current global pricing fallback. Edited");
  assert.equal(cleanProductDescription(null), "");
});

test("retail reads only the authenticated tenant's live pricing settings", async (t) => {
  t.mock.method(supabaseAdmin, "from", (table: string) => {
    assert.equal(table, "pricing_page_settings");
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => { assert.equal(key, "business_id"); assert.equal(value, "tenant-a"); return query; },
      maybeSingle: async () => ({ data: { headline: "Live headline", included_items: ["Live item"], bottom_note: "Live note", show_size_guide: false }, error: null }),
    };
    return query;
  });
  const value = await getPricingPageSettings("tenant-a");
  assert.equal(value.headline, "Live headline");
  assert.deepEqual(value.includedItems, ["Live item"]);
  assert.equal(value.bottomNote, "Live note");
  assert.equal(value.sizeGuide.enabled, false);
});

test("CMS has no pricing editor or writable Pricing keys; retail uses the single-screen loader", () => {
  const cms = readFileSync("src/lib/admin/cms.ts", "utf8");
  const editor = readFileSync("src/app/admin/(protected)/cms/retail-site/retail-site-cms-editor.tsx", "utf8");
  const retail = readFileSync("src/app/pricing/page.tsx", "utf8");
  const action = readFileSync("src/app/admin/(protected)/settings/pricing/actions.ts", "utf8");
  assert.doesNotMatch(cms + editor, /content\.pricing|PricingProduct|renderPricing|switchPage\("pricing"\)/);
  assert.match(retail, /getPricingPageSettings\(tenant.id\)/);
  assert.doesNotMatch(retail, /getTenantContent|preview|contentOptions/);
  assert.match(action, /business_id: session.business.id/);
  assert.doesNotMatch(action, /archived_cms:|draft_differences:/);
});

test("size guide component renders a toggle only for enabled product-backed rows", async () => {
  // Client component rendering uses React's client condition, unlike the server-only test process.
  const { execFileSync } = await import("node:child_process");
  execFileSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
    import assert from 'node:assert/strict';
    import React from 'react';
    import { renderToStaticMarkup } from 'react-dom/server';
    import Guide from './src/app/pricing/pricing-size-guide.tsx';
    import { getProductSizeGuideRows } from './src/lib/pricing-size-guide.ts';
    import { normalizePricingPageSettings } from './src/lib/pricing-page-content.ts';
    const product = { dumpsterProductId:'ten', dumpsterSize:'10 yard', displayName:'Ten', isPublic:true,
      sortOrder:1, truckLoadEstimate:'1-2 loads', sizeGuideExamples:'Cleanouts' };
    const content = { enabled:true, buttonText:'Choose a size', title:'Size guide' };
    const render = (products, settings=content) => renderToStaticMarkup(React.createElement(Guide,
      {content:settings, rows:getProductSizeGuideRows(products)}));
    assert.match(render([product]), /Choose a size/);
    assert.equal(render([]), '');
    assert.equal(render([{...product, isPublic:false}]), '');
    assert.equal(render([{...product, truckLoadEstimate:'', sizeGuideExamples:''}]), '');
    assert.equal(render([product], {...content, enabled:false}), '');
    const live = normalizePricingPageSettings({ show_size_guide:true,
      size_guide_button_text:'Live guide button', size_guide_title:'Live guide title',
      archived_cms:[{sizeGuide:{buttonText:'Retired CMS button'}}] });
    assert.match(render([product], live.sizeGuide), /Live guide button/);
    assert.doesNotMatch(render([product], live.sizeGuide), /Retired CMS button/);
  `], { cwd: process.cwd(), stdio: "pipe" });
});
