import test from "node:test";
import assert from "node:assert/strict";
import { customDateRangeError, isValidFinancialDate, resolveFinancialDateRange } from "../src/lib/financials/date-filters";

test("defaults to this month through today and retains explicitly selected presets", () => {
  assert.deepEqual(resolveFinancialDateRange(undefined, undefined, undefined, "2026-10-27"), { preset: "month", start: "2026-10-01", end: "2026-10-27" });
  assert.deepEqual(resolveFinancialDateRange("7d", undefined, undefined, "2026-03-02"), { preset: "7d", start: "2026-02-24", end: "2026-03-02" });
  assert.deepEqual(resolveFinancialDateRange("30d", undefined, undefined, "2026-01-15"), { preset: "30d", start: "2025-12-17", end: "2026-01-15" });
  assert.deepEqual(resolveFinancialDateRange("all", undefined, undefined, "2026-10-27"), { preset: "all", start: "", end: "" });
});

test("custom dates require real dates and an inclusive non-reversed range", () => {
  assert.equal(customDateRangeError("2026-10-27", "2026-10-27"), null);
  assert.equal(customDateRangeError("2026-10-28", "2026-10-27"), "To date must be on or after From date.");
  assert.ok(customDateRangeError("", "2026-10-27"));
  assert.ok(customDateRangeError("2026-10-01", ""));
  assert.equal(isValidFinancialDate("2026-02-29"), false);
  assert.equal(isValidFinancialDate("2028-02-29"), true);
  assert.equal(isValidFinancialDate("2026-04-31"), false);
  assert.equal(isValidFinancialDate("2026-13-01"), false);
});

test("custom links persist while incomplete, reversed and invalid links fall back to the default", () => {
  assert.deepEqual(resolveFinancialDateRange("custom", "2026-09-10", "2026-10-15", "2026-10-27"), { preset: "custom", start: "2026-09-10", end: "2026-10-15" });
  for (const [start, end] of [["2026-10-01", ""], ["2026-10-28", "2026-10-27"], ["2026-02-30", "2026-10-27"]]) {
    assert.deepEqual(resolveFinancialDateRange("custom", start, end, "2026-10-27"), { preset: "month", start: "2026-10-01", end: "2026-10-27" });
  }
});
