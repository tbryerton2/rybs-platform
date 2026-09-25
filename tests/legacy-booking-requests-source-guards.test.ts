import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");
const runtimeRoots = ["src", "tests", "scripts", "docs"];
const allowedRuntimeMentions = new Set(["tests/legacy-booking-requests-source-guards.test.ts"]);

function listFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) return listFiles(path);
    return [path];
  });
}

test("legacy booking_requests table is not used by active runtime code", () => {
  const mentions = runtimeRoots.flatMap((root) =>
    listFiles(resolve(repoRoot, root))
      .filter((file) => /\.(ts|tsx|js|mjs|md)$/.test(file))
      .flatMap((file) => {
        const repoPath = relative(repoRoot, file);
        if (allowedRuntimeMentions.has(repoPath)) return [];
        return readFileSync(file, "utf8").includes("booking_requests") ? [repoPath] : [];
      }),
  );

  assert.deepEqual(mentions, []);
});

test("local seed no longer inserts obsolete booking_requests fixture data", () => {
  const seedSql = readFileSync(resolve(repoRoot, "supabase/seed.sql"), "utf8");

  assert.doesNotMatch(seedSql, /insert\s+into\s+public\.booking_requests/i);
  assert.match(seedSql, /insert\s+into\s+public\.rental_action_requests/i);
});
