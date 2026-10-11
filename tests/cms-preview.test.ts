import test from "node:test";
import assert from "node:assert/strict";

import {
  CMS_PREVIEW_TOKEN_TTL_SECONDS,
  createCmsPreviewToken,
  normalizeCmsPreviewRedirectPath,
  verifyCmsPreviewToken,
} from "../src/lib/admin/cms-preview.ts";

test("CMS preview redirect paths stay on supported public pages", () => {
  assert.equal(normalizeCmsPreviewRedirectPath("/"), "/");
  assert.equal(normalizeCmsPreviewRedirectPath("/pricing?zip=12345"), "/pricing?zip=12345");
  assert.equal(normalizeCmsPreviewRedirectPath("/confirm"), "/confirm");
  assert.equal(normalizeCmsPreviewRedirectPath("https://app.rybsoftware.com/admin/cms"), "/");
  assert.equal(normalizeCmsPreviewRedirectPath("//app.rybsoftware.com/pricing"), "/");
  assert.equal(normalizeCmsPreviewRedirectPath("/admin/cms"), "/");
});

test("CMS preview tokens are signed, short-lived, and normalize redirect payloads", () => {
  const now = 1_800_000_000_000;
  const token = createCmsPreviewToken({
    tenantId: "tenant-123",
    redirectPath: "/pricing?zip=12345",
    now,
  });

  assert.deepEqual(verifyCmsPreviewToken(token, now), {
    tenantId: "tenant-123",
    redirectPath: "/pricing?zip=12345",
  });
  assert.equal(verifyCmsPreviewToken(`${token.slice(0, -1)}x`, now), null);
  assert.equal(verifyCmsPreviewToken(token, now + (CMS_PREVIEW_TOKEN_TTL_SECONDS + 1) * 1000), null);
});
