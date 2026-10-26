import test from "node:test";
import assert from "node:assert/strict";
import { completeBookingHistory, enterBookingHistory } from "../src/lib/booking-navigation.ts";

function createBrowser() {
  const values = new Map<string, string>();
  const entries: unknown[] = [null];
  let index = 0;
  let replacements = 0;
  const sessionStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  } as Storage;
  const history = {
    get state() { return entries[index]; },
    replaceState(state: unknown) {
      entries[index] = structuredClone(state);
      replacements++;
    },
  } as History;
  return {
    history,
    sessionStorage,
    push(state: unknown = null) {
      entries.splice(index + 1);
      entries.push(structuredClone(state));
      index++;
    },
    go(nextIndex: number) { index = nextIndex; },
    get length() { return entries.length; },
    get replacements() { return replacements; },
  };
}

const bookingSteps = ["/book/address", "/book", "/book/date", "/book/placement", "/confirm", "/checkout"];

test("Back and Forward through unfinished booking steps remain available", () => {
  const browser = createBrowser();
  for (const step of bookingSteps) {
    browser.push({ route: step });
    assert.equal(enterBookingHistory(browser, "unfinished"), true);
  }
  for (const index of [5, 4, 3, 2, 1, 2, 3, 4, 5, 6]) {
    browser.go(index);
    assert.equal(enterBookingHistory(browser, "unfinished"), true);
  }
  assert.equal(browser.length, 7, "the guard must not add history entries");
});

test("every earlier booking step is rejected after successful completion", () => {
  const browser = createBrowser();
  for (const step of bookingSteps) {
    browser.push({ route: step });
    enterBookingHistory(browser, "completed");
  }
  completeBookingHistory(browser, "completed");
  browser.push({ route: "/success" });
  const replacements = browser.replacements;
  for (let index = 6; index > 0; index--) {
    browser.go(index);
    assert.equal(enterBookingHistory(browser, "completed"), false, bookingSteps[index - 1]);
  }
  assert.equal(browser.replacements, replacements, "stale entries must never be reactivated");
});

test("a fresh booking works, while history from the previous booking stays closed", () => {
  const browser = createBrowser();
  enterBookingHistory(browser, "repeat");
  completeBookingHistory(browser, "repeat");
  browser.push({ route: "/success" });
  browser.push({ route: "/" });
  browser.push({ route: "/book/address?reorderFrom=previous" });
  assert.equal(enterBookingHistory(browser, "repeat"), true);
  browser.push({ route: "/book/date" });
  assert.equal(enterBookingHistory(browser, "repeat"), true);
  browser.go(0);
  assert.equal(enterBookingHistory(browser, "repeat"), false);
  browser.go(3);
  assert.equal(enterBookingHistory(browser, "repeat"), true);
  browser.go(4);
  completeBookingHistory(browser, "repeat");
  browser.go(3);
  assert.equal(enterBookingHistory(browser, "repeat"), false);
});

test("history validation preserves router metadata and is idempotent", () => {
  const browser = createBrowser();
  const routerState = { __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: { tree: ["book"] }, custom: "keep" };
  browser.history.replaceState(routerState, "");
  assert.equal(enterBookingHistory(browser, "metadata"), true);
  assert.equal(browser.history.state.__NA, true);
  assert.deepEqual(browser.history.state.__PRIVATE_NEXTJS_INTERNALS_TREE, routerState.__PRIVATE_NEXTJS_INTERNALS_TREE);
  assert.equal(browser.history.state.custom, "keep");
  const replacements = browser.replacements;
  assert.equal(enterBookingHistory(browser, "metadata"), true);
  assert.equal(browser.replacements, replacements);
});

test("completion survives recreating the browser controller with stored session and history", () => {
  const original = createBrowser();
  enterBookingHistory(original, "reload");
  completeBookingHistory(original, "reload");
  const restored = createBrowser();
  restored.history.replaceState(original.history.state, "");
  restored.sessionStorage.setItem("reload", original.sessionStorage.getItem("reload")!);
  assert.equal(enterBookingHistory(restored, "reload"), false);
});

test("one tenant's completion does not close another tenant's booking", () => {
  const browser = createBrowser();
  enterBookingHistory(browser, "tenant_a_booking_history_version");
  browser.push();
  enterBookingHistory(browser, "tenant_b_booking_history_version");
  completeBookingHistory(browser, "tenant_a_booking_history_version");
  assert.equal(enterBookingHistory(browser, "tenant_b_booking_history_version"), true);
  browser.go(0);
  assert.equal(enterBookingHistory(browser, "tenant_a_booking_history_version"), false);
});

test("unavailable session storage does not break successful checkout navigation", () => {
  const browser = createBrowser();
  const unavailable = {
    history: browser.history,
    get sessionStorage(): Storage { throw new Error("Storage disabled"); },
  };
  assert.equal(enterBookingHistory(unavailable, "unavailable"), true);
  assert.doesNotThrow(() => completeBookingHistory(unavailable, "unavailable"));
  assert.equal(enterBookingHistory(unavailable, "unavailable"), false);
  browser.push();
  assert.equal(enterBookingHistory(unavailable, "unavailable"), true);
});

test("malformed history and storage do not prevent a fresh booking", () => {
  const browser = createBrowser();
  browser.sessionStorage.setItem("malformed", "not a number");
  browser.history.replaceState({ retailBooking: { storageKey: "malformed", version: "bad" } }, "");
  assert.equal(enterBookingHistory(browser, "malformed"), true);
  completeBookingHistory(browser, "malformed");
  assert.equal(enterBookingHistory(browser, "malformed"), false);
});
