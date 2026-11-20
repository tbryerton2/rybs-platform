import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { tooltipPosition, tooltipReducer, type TooltipAction, type TooltipState } from "../src/app/admin/_components/info-tooltip-behavior";

function interact(...actions: TooltipAction[]) {
  return actions.reduce<TooltipState>(tooltipReducer, "closed");
}

test("desktop hover opens a preview and leaving closes it", () => {
  assert.equal(interact("preview"), "preview");
  assert.equal(interact("preview", "leave"), "closed");
});

test("click pins a hover/focus preview; a second click closes it", () => {
  assert.equal(interact("preview", "toggle", "leave"), "pinned");
  assert.equal(interact("preview", "toggle", "toggle"), "closed");
});

test("touch taps toggle with or without a preceding focus event", () => {
  assert.equal(interact("toggle", "leave"), "pinned");
  assert.equal(interact("toggle", "toggle"), "closed");
  assert.equal(interact("preview", "toggle", "leave", "toggle"), "closed");
  assert.equal(interact("toggle", "toggle", "toggle"), "pinned");
});

test("keyboard focus opens; activation pins; Escape/outside dismissal closes every state", () => {
  for (const state of ["closed", "preview", "pinned"] as const) {
    assert.equal(tooltipReducer(state, "dismiss"), "closed");
  }
  assert.equal(interact("preview", "toggle"), "pinned");
  assert.equal(interact("preview", "toggle", "dismiss", "leave"), "closed");
  assert.equal(interact("preview", "dismiss"), "closed");
});

test("tooltips fit narrow, tablet, desktop, and zoomed viewports at all edges", () => {
  for (const viewport of [
    { left: 0, top: 0, width: 320, height: 480 },
    { left: 0, top: 0, width: 768, height: 1024 },
    { left: 0, top: 0, width: 1440, height: 900 },
    { left: 150, top: 200, width: 240, height: 300 },
  ]) {
    const tooltip = { width: Math.min(256, viewport.width - 24), height: 100 };
    for (const align of ["left", "right"] as const) {
      for (const x of [viewport.left, viewport.left + viewport.width - 24]) {
        for (const y of [viewport.top, viewport.top + viewport.height - 24]) {
          const position = tooltipPosition({ left: x, right: x + 24, top: y, bottom: y + 24 }, tooltip, viewport, align);
          assert.ok(position.left >= viewport.left + 12);
          assert.ok(position.left + tooltip.width <= viewport.left + viewport.width - 12);
          assert.ok(position.top >= viewport.top + 12);
          assert.ok(position.top + tooltip.height <= viewport.top + viewport.height - 12);
        }
      }
    }
  }
});

test("positioning preserves alignment and flips above near the bottom", () => {
  const viewport = { left: 0, top: 0, width: 768, height: 1024 };
  const tooltip = { width: 256, height: 100 };
  assert.deepEqual(tooltipPosition({ left: 300, right: 324, top: 100, bottom: 124 }, tooltip, viewport, "left"), { left: 300, top: 132 });
  assert.deepEqual(tooltipPosition({ left: 300, right: 324, top: 100, bottom: 124 }, tooltip, viewport, "right"), { left: 68, top: 132 });
  assert.deepEqual(tooltipPosition({ left: 300, right: 324, top: 980, bottom: 1004 }, tooltip, viewport, "left"), { left: 300, top: 872 });
});

test("rendered cards keep the navigation link separate from the info button", () => {
  // Render in Node with normal React conditions; the main suite uses react-server.
  const html = execFileSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
    import { createElement } from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import { SnapshotCard } from "./src/app/admin/_components/SnapshotCard.tsx";
    const icon = () => createElement("svg");
    process.stdout.write(renderToStaticMarkup(createElement(SnapshotCard, {
      label: "Stops Scheduled", value: 5, icon, href: "/admin/dispatch",
      tooltip: "Scheduled delivery and pickup stops.",
    })));
  `], { cwd: process.cwd(), encoding: "utf8" });
  const links = [...html.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/g)];
  assert.equal(links.length, 1);
  assert.match(links[0][0], /href="\/admin\/dispatch"/);
  assert.match(links[0][0], /aria-label="Stops Scheduled"/);
  assert.match(links[0][0], /absolute inset-0 z-10/);
  assert.doesNotMatch(links[0][0], /<button\b/);
  assert.match(html, /<button[^>]*type="button"[^>]*aria-label="Stops Scheduled definition"[^>]*aria-expanded="false"/);
  assert.match(html, /pointer-events-none relative z-20/);
  assert.match(html, /pointer-events-auto/);
});

test("dashboard shares one tooltip with pointer, keyboard, and navigation guards", () => {
  const component = readFileSync("src/app/admin/_components/InfoTooltip.tsx", "utf8");
  const dashboard = readFileSync("src/app/admin/(protected)/page.tsx", "utf8");
  const snapshot = readFileSync("src/app/admin/_components/SnapshotCard.tsx", "utf8");
  assert.match(component, /onPointerEnter=\{\(event\) => \{\s*if \(event.pointerType !== "touch"\) preview\(\)/);
  assert.match(component, /onFocus=\{preview\}/);
  assert.match(component, /onClick=\{\(event\) => \{\s*event.preventDefault\(\);\s*event.stopPropagation\(\);\s*cancelClose\(\);\s*dispatch\("toggle"\)/);
  assert.match(component, /addEventListener\("pointerdown", dismissOutside, true\)/);
  assert.match(component, /triggerRef.current\?\.contains\(event.target\)/);
  assert.match(component, /tooltipRef.current\?\.contains\(event.target\)/);
  assert.match(component, /event.key === "Escape"/);
  assert.match(component, /aria-describedby=\{open \? id : undefined\}/);
  assert.match(component, /role="tooltip"/);
  assert.match(component, /createPortal\(/);
  assert.match(component, /window.visualViewport\?\.addEventListener\("resize", reposition\)/);
  for (const source of [dashboard, snapshot]) {
    assert.match(source, /<InfoTooltip\b/);
    assert.doesNotMatch(source, /group-hover:opacity-100/);
  }
});
