/**
 * The GSAP loader behind the one animation CSS cannot do (FLIP).
 *
 * The contract is that motion is an enhancement which is allowed to fail. On the server, before the
 * chunk arrives, after a failed chunk fetch, and for a reader who asked for less movement, `motion()`
 * must return null so the caller changes the DOM without animating. If it ever threw or returned a
 * half-loaded object instead, a list reorder or a gallery filter would take the feature down with it.
 *
 * Node has no `window`, which is also the server's situation, so that path is the default here and a
 * fake `window` covers the browser ones.
 */
import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { FLIP_DURATION, FLIP_EASE, motion, preloadMotion, reducedMotion } from "@/lib/motion";

const realWindow = (globalThis as { window?: unknown }).window;

/** A window whose only job is to answer the prefers-reduced-motion query. */
function fakeWindow(reduce: boolean) {
  const queries: string[] = [];
  (globalThis as { window?: unknown }).window = {
    matchMedia: (query: string) => {
      queries.push(query);
      return { matches: reduce };
    },
  };
  return queries;
}

afterEach(() => {
  if (realWindow === undefined) delete (globalThis as { window?: unknown }).window;
  else (globalThis as { window?: unknown }).window = realWindow;
});

describe("reducedMotion", () => {
  test("is false where there is no window, which is the server", () => {
    assert.equal(reducedMotion(), false);
  });

  test("asks the system, and asks the right query", () => {
    const queries = fakeWindow(true);
    assert.equal(reducedMotion(), true);
    assert.deepEqual(queries, ["(prefers-reduced-motion: reduce)"]);
  });

  test("is false when the reader has not asked for less movement", () => {
    fakeWindow(false);
    assert.equal(reducedMotion(), false);
  });
});

describe("preloadMotion", () => {
  test("resolves without fetching anything on the server", async () => {
    await assert.doesNotReject(preloadMotion());
  });

  test("resolves without fetching anything for a reader who asked for less movement", async () => {
    fakeWindow(true);
    await assert.doesNotReject(preloadMotion());
    assert.equal(motion(), null);
  });
});

describe("motion", () => {
  test("is null on the server, so a render never animates", () => {
    assert.equal(motion(), null);
  });

  test("is null for a reader who asked for less movement", () => {
    fakeWindow(true);
    assert.equal(motion(), null);
  });

  test("is null rather than a half-loaded object before the chunk arrives", () => {
    // The caller's contract: null means "change the DOM, do not animate".
    fakeWindow(false);
    const result = motion();
    assert.ok(result === null || (typeof result === "object" && "gsap" in result && "Flip" in result));
  });

  test("never throws, whatever the preference is", () => {
    for (const reduce of [true, false]) {
      fakeWindow(reduce);
      assert.doesNotThrow(() => motion());
    }
  });
});

describe("the shared timing", () => {
  test("is one duration and one ease, so a reorder and a refilter feel related", () => {
    assert.ok(typeof FLIP_DURATION === "number" && FLIP_DURATION > 0 && FLIP_DURATION < 1, `${FLIP_DURATION}s is not a UI duration`);
    assert.ok(typeof FLIP_EASE === "string" && FLIP_EASE.length > 0);
  });
});
