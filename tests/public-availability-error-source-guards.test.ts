import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");

function readRepoFile(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

test("public availability APIs log unexpected failures without leaking raw backend messages", () => {
  const availability = readRepoFile("src/app/api/availability/route.ts");
  const calendar = readRepoFile("src/app/api/availability/calendar/route.ts");

  for (const source of [availability, calendar]) {
    assert.match(source, /console\.error/);
    assert.match(source, /Please try again\./);
    assert.doesNotMatch(source, /error instanceof Error \? error\.message/);
    assert.doesNotMatch(source, /error: message/);
  }

  assert.match(availability, /isPublicDumpsterProductError\(error\)/);
  assert.match(calendar, /isPublicDumpsterProductError\(error\)/);
});
