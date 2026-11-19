/** vercel.json: what Vercel refuses before a build starts, and so never shows in a build log. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const config = JSON.parse(readFileSync("vercel.json", "utf8")) as { ignoreCommand?: string };

describe("vercel.json", () => {
  // Vercel fails the deployment outright when `ignoreCommand` is longer than
  // this. Production stood still on 2026-11-19 over a 311-character one.
  test("keeps ignoreCommand within Vercel's 256 characters", () => {
    assert.ok((config.ignoreCommand?.length ?? 0) <= 256);
  });

  test("points ignoreCommand at a script that exists", () => {
    const script = config.ignoreCommand?.match(/^bash (\S+)$/)?.[1];
    assert.ok(script && existsSync(script), `no script behind ${config.ignoreCommand}`);
  });
});
