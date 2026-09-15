import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");

function readRepoFile(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

function getSnippetBetween(source: string, start: string, end: string) {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `Expected source to contain ${start}`);

  const endIndex = source.indexOf(end, startIndex);
  assert.notEqual(endIndex, -1, `Expected source to contain ${end}`);

  return source.slice(startIndex, endIndex);
}

test("checkout fetches Square config before initializing the rendered card container", () => {
  const checkout = readRepoFile("src/app/checkout/checkout-page-client.tsx");
  const configEffect = getSnippetBetween(
    checkout,
    'const response = await fetch("/api/payments/square/checkout-config"',
    "  }, [hydrated]);",
  );
  const initEffect = getSnippetBetween(
    checkout,
    "if (!hydrated || squareConfig?.configured !== true) return;",
    "  }, [hydrated, squareConfig]);",
  );

  assert.match(checkout, /const MAX_SQUARE_INIT_ATTEMPTS = 3;/);
  assert.match(checkout, /function getSquareInitRetryDelayMs\(attemptIndex: number\)/);

  assert.match(configEffect, /setSquareConfig\(tenantSquareConfig\)/);
  assert.match(configEffect, /if \(!tenantSquareConfig\.configured\)/);
  assert.doesNotMatch(configEffect, /loadSquareScript/);
  assert.doesNotMatch(configEffect, /\.card\(\)/);
  assert.doesNotMatch(configEffect, /\.attach\(/);

  assert.match(initEffect, /document\.getElementById\(SQUARE_CARD_CONTAINER_ID\)/);
  assert.match(initEffect, /await loadSquareScript\(squareConfig\.environment\)/);
  assert.match(initEffect, /await payments\.card\(\)/);
  assert.match(initEffect, /await card\.attach\(`#\$\{SQUARE_CARD_CONTAINER_ID\}`\)/);
  assert.match(initEffect, /attempt < MAX_SQUARE_INIT_ATTEMPTS - 1/);
  assert.match(initEffect, /await wait\(getSquareInitRetryDelayMs\(attempt\)\)/);
  assert.match(initEffect, /setSquareFallbackReason\(PAYMENT_UNAVAILABLE_MESSAGE\)/);
});
