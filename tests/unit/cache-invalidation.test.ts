/**
 * Static checks on the `use cache` getters and the staff actions that invalidate them.
 *
 * There is no Next runtime here, so these read the source text. That is crude but it pins the failure
 * CLAUDE.md warns about: a cached getter whose tag no staff action ever invalidates keeps serving the
 * old text until `expire`, and nothing at runtime says so.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TAG } from "@/lib/data";

const read = (rel: string) => readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");
const GETTER_FILES = ["src/lib/data.ts", "src/lib/preorders.ts"];
const ACTIONS = read("src/app/staff/actions.ts");

/** Every `"use cache"` function: its name and its body, up to the next top-level declaration. */
function cachedGetters(src: string) {
  const out: { name: string; body: string }[] = [];
  const re = /export async function (\w+)\([^)]*\)[^\n]*\{\n\s*"use cache";([\s\S]*?)(?=\n(?:export |\/\*\*|type )|$)/g;
  for (const m of src.matchAll(re)) out.push({ name: m[1], body: m[2] });
  return out;
}

const getters = GETTER_FILES.flatMap((f) => cachedGetters(read(f)));

/** Tag names (keys of TAG) passed to cacheTag(TAG.x) in a getter body. */
const tagsOf = (body: string) => [...body.matchAll(/cacheTag\(\s*TAG\.(\w+)\s*\)/g)].map((m) => m[1]);

/** Tags that exist but no staff action needs to invalidate. Keep empty unless there is a reason. */
const NEVER_INVALIDATED_BY_STAFF: string[] = [];

describe("use cache getters", () => {
  test("the scan finds the getters (guards against the regex silently matching nothing)", () => {
    assert.ok(getters.length >= 12, `only found ${getters.length} getters`);
    assert.ok(getters.some((g) => g.name === "getOpeningHours"));
    assert.ok(getters.some((g) => g.name === "getPickupRange"));
  });

  test("each has a cacheLife and exactly one cacheTag taken from TAG (no raw strings)", () => {
    for (const g of getters) {
      assert.match(g.body, /cacheLife\(/, `${g.name} has no cacheLife`);
      assert.equal(tagsOf(g.body).length, 1, `${g.name} must tag its entry with one TAG.*`);
      assert.ok(Object.keys(TAG).includes(tagsOf(g.body)[0]), `${g.name} uses an unknown tag`);
    }
  });

  test("none swallows a failed read: every Supabase result goes through unwrap()", () => {
    for (const g of getters) {
      // `const { data } = await supabase...` ignores `error`, which caches the empty result.
      assert.doesNotMatch(g.body, /const \{[^}]*\bdata\b[^}]*\}\s*=\s*await/, `${g.name} destructures data without checking error`);
      assert.doesNotMatch(g.body, /\bif \(error\) return\b/, `${g.name} turns an error into a cached fallback`);
    }
  });

  test("getActiveSpecials uses a short profile, because 'today' is baked into the entry", () => {
    const g = getters.find((x) => x.name === "getActiveSpecials");
    assert.ok(g);
    assert.match(g.body, /cacheLife\("minutes"\)/);
    assert.match(g.body, /todayISO\(\)/);
  });
});

describe("staff actions invalidate what the getters cache", () => {
  const invalidatedKeys = new Set([...ACTIONS.matchAll(/updateTag\(\s*TAG\.(\w+)\s*\)/g)].map((m) => m[1]));

  test("every updateTag(...) uses a TAG.* member that exists, never a raw string", () => {
    const all = [...ACTIONS.matchAll(/updateTag\(([^)]*)\)/g)].map((m) => m[1].trim());
    assert.ok(all.length > 0, "found no updateTag calls");
    for (const arg of all) {
      const m = /^TAG\.(\w+)$/.exec(arg);
      assert.ok(m, `updateTag(${arg}) is not a TAG.* reference`);
      assert.ok(Object.keys(TAG).includes(m[1]), `updateTag(${arg}) names a tag that does not exist`);
    }
  });

  test("every tag a getter uses is invalidated by at least one staff action", () => {
    const used = new Set(getters.flatMap((g) => tagsOf(g.body)));
    for (const key of used) {
      if (NEVER_INVALIDATED_BY_STAFF.includes(key)) continue;
      assert.ok(invalidatedKeys.has(key), `TAG.${key} is cached but no staff action calls updateTag(TAG.${key})`);
    }
  });

  test("every tag in TAG is used by some getter (no dead tags)", () => {
    const used = new Set(getters.flatMap((g) => tagsOf(g.body)));
    for (const key of Object.keys(TAG)) assert.ok(used.has(key), `TAG.${key} tags no getter`);
  });
});
