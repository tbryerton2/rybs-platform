import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");

test("Next.js 16 proxy activates canonical admin routing", () => {
  const proxyPath = resolve(repoRoot, "src/proxy.ts");
  const legacyMiddlewarePath = resolve(repoRoot, "src/middleware.ts");
  const source = readFileSync(proxyPath, "utf8");

  assert.equal(existsSync(legacyMiddlewarePath), false);
  assert.match(source, /export function proxy\(request: NextRequest\)/);
  assert.match(source, /getCanonicalAdminRedirectUrl/);
  assert.match(source, /process\.env\.ADMIN_APP_URL/);
  assert.match(source, /"\/admin\/:path\*"/);
  assert.match(source, /"\/platform-admin\/:path\*"/);
});
