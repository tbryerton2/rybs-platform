import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");

function readRepoFile(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

test("public retail shell exposes customer portal links without tenant-specific URLs", () => {
  const layout = readRepoFile("src/app/layout.tsx");
  const mobileMenu = readRepoFile("src/components/PublicRetailHeaderMenu.tsx");

  assert.match(layout, /href="\/portal"/);
  assert.match(layout, /Customer Portal/);
  assert.match(layout, /Manage your booking/);
  assert.match(layout, /PublicRetailHeaderMenu/);
  assert.match(layout, /hidden min-w-0 .* md:flex/);
  assert.match(layout, /!isAdminSurface/);
  assert.match(mobileMenu, /aria-expanded=\{open\}/);
  assert.match(mobileMenu, /aria-controls=\{menuId\}/);
  assert.match(mobileMenu, /href="\/portal"/);
  assert.match(mobileMenu, /href=\{emailHref\}/);
  assert.match(mobileMenu, /href=\{phoneHref\}/);
  assert.match(mobileMenu, /document\.addEventListener\("keydown"/);
  assert.match(mobileMenu, /document\.addEventListener\("pointerdown"/);
  assert.doesNotMatch(layout, /tancanman/i);
  assert.doesNotMatch(layout, /demo-dumpster/i);
  assert.doesNotMatch(mobileMenu, /tancanman/i);
  assert.doesNotMatch(mobileMenu, /demo-dumpster/i);
});
