/**
 * The test that makes a coverage gap impossible to add quietly.
 *
 * Node's coverage report only lists files it actually loaded, so a module no test imports does not
 * appear in it at all: before this file existed, `npm run test:unit` reported 96.99% while fourteen
 * modules had no test whatsoever, including the guard that keeps writes off the production database.
 * A percentage that goes *up* when a module stops being covered is worse than no percentage.
 *
 * So this works from the file system instead. Every module under `src/lib` has to be reachable from
 * some test, directly or through another module that a test imports, or be named below with a reason.
 * The same for every page under `src/app`: it has to be in one of the browser suite's page lists, or
 * covered by a file that drives it, or excused here.
 *
 * Adding a module and forgetting the test is then a failing test, with the module's name in it.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

const read = (file: string) => readFileSync(file, "utf8");

/** Every `@/...` specifier a file imports, re-exports or `import()`s. */
function aliasImports(source: string): string[] {
  return [...source.matchAll(/["'](@\/[^"']+)["']/g)].map((m) => m[1]);
}

/** `@/lib/dates` -> `src/lib/dates.ts`, following the same candidates as tests/alias-hook.mjs. */
function resolveAlias(specifier: string): string | null {
  const base = path.join(ROOT, "src", specifier.slice(2));
  for (const candidate of [`${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), path.join(base, "index.tsx"), base]) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      /* next candidate */
    }
  }
  return null;
}

const TEST_FILES = [...walk(path.join(ROOT, "tests", "unit")), ...walk(path.join(ROOT, "tests", "integration"))].filter((f) =>
  /\.(ts|mjs)$/.test(f),
);

/**
 * Every source file reachable from a test: the modules the tests import, plus everything those
 * modules import, transitively.
 *
 * Transitive counts on purpose. `supabase/public.ts` has no test of its own and never needs one:
 * `getMenu` cannot run without it, so the integration tests exercise it on every call.
 */
const reachable = (() => {
  const seen = new Set<string>();
  const queue = TEST_FILES.flatMap((file) => aliasImports(read(file)));
  while (queue.length > 0) {
    const resolved = resolveAlias(queue.pop()!);
    if (!resolved || seen.has(resolved)) continue;
    seen.add(resolved);
    try {
      queue.push(...aliasImports(read(resolved)));
    } catch {
      /* a directory or a file that cannot be read is not a module */
    }
  }
  return seen;
})();

/**
 * Modules no test reaches, each with the reason.
 *
 * Every one of these needs a live request to exist before it can even be imported: `next/headers`
 * and `next/navigation` throw outside a request, so there is nothing a hermetic test can call. They
 * are covered through the browser instead, which is named per entry.
 */
const LIB_WITHOUT_TESTS: Record<string, string> = {
  "src/lib/auth.ts":
    "cookies() and redirect() need a request. Exercised by tests/e2e/staff.test.mjs (sign-in, every staff page, the redirect for a signed-out visitor) and by the is_staff/is_admin tests in tests/integration/staff.test.mjs.",
  "src/lib/public-forms.ts":
    "headers() needs a request; it reads x-forwarded-for to build the quota bucket. The quota function it calls is covered in tests/integration/grants.test.mjs, and the forms it serves in tests/e2e/public.test.mjs.",
  "src/lib/supabase/server.ts": "cookies() needs a request. Every staff page in tests/e2e/staff.test.mjs runs through it.",
  "src/lib/supabase/proxy.ts": "NextResponse needs the Next runtime. Session refresh is observed by the sign-in tests in tests/e2e/staff.test.mjs.",
  // database.types.ts needs no entry: it is generated, but the modules under test import `Tables`
  // from it, so it is reachable and the stale-entry check below would reject an excuse for it.
};

describe("every module under src/lib is reachable from a test", () => {
  const libFiles = walk(path.join(ROOT, "src", "lib"))
    .filter((f) => f.endsWith(".ts"))
    .map((f) => path.relative(ROOT, f));

  test("none is both untested and unexplained", () => {
    const untested = libFiles.filter((f) => !reachable.has(path.join(ROOT, f)) && !(f in LIB_WITHOUT_TESTS));
    assert.deepEqual(
      untested,
      [],
      `these modules have no test and no entry in LIB_WITHOUT_TESTS. Add a test, or add the module ` +
        `with the reason it cannot have one.`,
    );
  });

  test("the list of excuses has no stale entries", () => {
    // A module that gained a test, or was deleted, must not keep its excuse: the next person reads
    // it as "this cannot be tested" and believes it.
    const stale = Object.keys(LIB_WITHOUT_TESTS).filter((f) => !libFiles.includes(f) || reachable.has(path.join(ROOT, f)));
    assert.deepEqual(stale, [], "these modules are excused but are now tested, or no longer exist");
  });

  test("every excuse says why, not just that", () => {
    for (const [file, reason] of Object.entries(LIB_WITHOUT_TESTS)) {
      assert.ok(reason.length > 40, `${file}: the reason is too short to be a reason`);
      assert.match(reason, /tests\/|Generated/, `${file}: the reason should name what covers it instead`);
    }
  });
});

describe("every page under src/app is opened by the browser suite", () => {
  const harness = read(path.join(ROOT, "tests", "e2e", "harness.mjs"));
  const e2e = walk(path.join(ROOT, "tests", "e2e"))
    .filter((f) => f.endsWith(".mjs"))
    .map(read)
    .join("\n");

  /** `src/app/(de)/karte/page.tsx` -> `/karte`; a route group in brackets contributes nothing. */
  const routeOf = (file: string) => {
    const segments = path
      .relative(path.join(ROOT, "src", "app"), path.dirname(file))
      .split(path.sep)
      .filter((s) => s.length > 0 && !(s.startsWith("(") && s.endsWith(")")));
    return `/${segments.join("/")}`;
  };

  /**
   * Pages the browser suite does not open by URL, each with the reason.
   *
   * The token routes are the interesting entry: they are covered, by tests/e2e/token-routes.test.mjs,
   * but with a token arranged at run time, so the URL cannot appear in a page list.
   */
  const PAGES_NOT_IN_A_LIST: Record<string, string> = {
    "/reservierung/[token]": "tests/e2e/token-routes.test.mjs, with a reservation arranged at run time",
    "/vorbestellung/[token]": "tests/e2e/token-routes.test.mjs, with an order arranged at run time",
    "/abmelden/[token]": "tests/e2e/token-routes.test.mjs, with a sign-up arranged at run time",
    "/en/reservierung/[token]": "tests/e2e/token-routes.test.mjs",
    "/en/vorbestellung/[token]": "tests/e2e/token-routes.test.mjs",
    "/en/abmelden/[token]": "tests/e2e/token-routes.test.mjs",
    "/es/reservierung/[token]": "tests/e2e/token-routes.test.mjs",
    "/es/vorbestellung/[token]": "tests/e2e/token-routes.test.mjs",
    "/es/abmelden/[token]": "tests/e2e/token-routes.test.mjs",
    "/specials/confirm": "The one-time email token is covered by the Supabase RPC grant matrix; live delivery needs Resend configuration.",
    "/staff/offline": "The service worker's offline fallback. Opened by tests/e2e/pwa.test.mjs rather than as a page.",
  };

  const routes = walk(path.join(ROOT, "src", "app"))
    .filter((f) => path.basename(f) === "page.tsx")
    .map(routeOf);

  test("no page is both unopened and unexplained", () => {
    const unopened = routes.filter((route) => {
      if (route in PAGES_NOT_IN_A_LIST) return false;
      // A route counts as opened if it is quoted anywhere in the browser suite.
      return !harness.includes(`"${route}"`) && !e2e.includes(`"${route}"`);
    });
    assert.deepEqual(unopened, [], "these pages are never opened by the browser suite");
  });

  test("the staff pages the navigation offers are all in STAFF_PAGES", () => {
    // /staff/besucher was missing from that list, which is the only reason no test ever opened it
    // and the only reason its table overflowed a phone unnoticed.
    const nav = read(path.join(ROOT, "src", "app", "staff", "nav.tsx"));
    const hrefs = [...nav.matchAll(/href:\s*"(\/staff[^"]*)"/g)].map((m) => m[1]);
    const missing = hrefs.filter((href) => !harness.includes(`"${href}"`));
    assert.deepEqual(missing, [], "the staff navigation offers these pages but no test opens them");
  });

  test("the list of excuses has no stale entries", () => {
    const stale = Object.keys(PAGES_NOT_IN_A_LIST).filter((route) => !routes.includes(route));
    assert.deepEqual(stale, [], "these routes are excused but no longer exist");
  });
});

describe("the database surface is covered", () => {
  const integration = walk(path.join(ROOT, "tests", "integration"))
    .filter((f) => f.endsWith(".mjs"))
    .map(read)
    .join("\n");

  test("every migration on disk is mentioned by a test, or is covered by the grant matrix", () => {
    // Not every migration needs naming, but the ones that changed who may do what are the ones a
    // later migration can silently undo, so schema.test.mjs holds the matrix and this keeps the
    // count of migrations visible.
    const migrations = readdirSync(path.join(ROOT, "supabase", "migrations")).filter((f) => f.endsWith(".sql"));
    assert.ok(migrations.length > 0, "no migrations found");
    assert.ok(
      integration.includes("schema_migrations"),
      "nothing checks that the migrations on disk are the ones applied to the database",
    );
  });

  test("the RPCs the application calls are all named in the grant matrix", () => {
    // Anything the app calls through .rpc() has to appear in schema.test.mjs's EXPECTED, or a
    // change to its grants goes unnoticed.
    const appSource = walk(path.join(ROOT, "src"))
      .filter((f) => /\.(ts|tsx)$/.test(f))
      .map(read)
      .join("\n");
    const called = new Set([...appSource.matchAll(/\.rpc\(\s*["']([a-z_]+)["']/g)].map((m) => m[1]));
    assert.ok(called.size > 0, "no RPC calls found in src, which cannot be right");
    const schema = read(path.join(ROOT, "tests", "integration", "schema.test.mjs"));
    const missing = [...called].filter((name) => !schema.includes(`${name}:`)).sort();
    assert.deepEqual(missing, [], "these RPCs are called by the app but are not in the grant matrix");
  });
});
