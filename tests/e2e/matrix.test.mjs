/**
 * The smoke test that runs as every browser and device in the matrix (issue #104).
 *
 *   npm run test:matrix                       # every project, see scripts/test-matrix.mjs
 *   E2E_PROJECT=iphone npm run test:e2e -- tests/e2e/matrix.test.mjs   # one of them
 *
 * Each project is a real engine (Blink, Gecko or WebKit) wearing a device descriptor: viewport,
 * user agent, touch, pixel ratio. That is enough to catch what actually differs between browsers
 * here: CSS that only one engine understands, `Intl` output that differs, a script that throws in
 * one runtime, a page that is wider than a phone. It is not iOS or Android, and no test in this
 * file claims otherwise.
 *
 * Nothing here submits a form.
 */
import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import {
  BASE,
  closeBrowser,
  describeOverflow,
  horizontalOverflow,
  PROJECT,
  PROJECTS,
  PUBLIC_PAGES,
  serverIsUp,
  visit,
} from "./harness.mjs";

const up = await serverIsUp();
after(closeBrowser);
const skip = up ? false : `no site at ${BASE}, run npm run dev`;
const { label, mobile } = PROJECTS[PROJECT];

describe(`${label}: every public page`, () => {
  for (const [name, path] of PUBLIC_PAGES) {
    test(name, { skip }, async () => {
      await visit(path, {
        native: true,
        body: async ({ page, response, errors }) => {
          assert.ok(response.status() < 400, `${path} answered ${response.status()}`);
          const expected = /^\/es(\/|$)/.test(path) ? "es-AR" : /^\/en(\/|$)/.test(path) ? "en-GB" : "de-DE";
          assert.equal(await page.locator("html").getAttribute("lang"), expected);
          assert.equal(await page.locator("h1").count(), 1, `${path} should have exactly one h1`);
          const result = await horizontalOverflow(page);
          assert.equal(result.overflow, 0, `${path} overflows sideways: ${describeOverflow(result)}`);
          await page.waitForTimeout(300);
          assert.deepEqual(errors, []);
        },
      });
    });
  }
});

describe(`${label}: the scripts run`, () => {
  // Hydration is where engines diverge: a missing API or a syntax the engine does not know leaves
  // a page that looks fine in the HTML and does nothing when touched.
  test("the open-now line is computed", { skip }, async () => {
    await visit("/", {
      native: true,
      body: async ({ page }) => {
        const line = page.locator(".open-status").first();
        await page.waitForFunction(() => document.querySelector(".open-status")?.dataset.state !== "pending", null, {
          timeout: 15_000,
        });
        assert.match(await line.getAttribute("data-state"), /^(open|later|closed)$/);
        assert.ok((await line.textContent()).trim().length > 3, "the line has no text");
      },
    });
  });

  test("a day can be chosen and times are offered", { skip }, async () => {
    await visit("/", {
      native: true,
      body: async ({ page }) => {
        // Deliberately not the *first* open day, which is today. Today runs out of bookable slots
        // during the evening: the lead time is two hours and the last seating is an hour before
        // close, so from about 19:30 Frankfurt time today offers nothing, correctly. Asserting that
        // today offers times therefore fails on any run late in the day, which is what happened on
        // main at 19:00. The next open day has a full day of slots whatever the hour.
        const open = page.locator(".day:not(:disabled):not(.is-today)").first();
        await open.scrollIntoViewIfNeeded();
        // A tap on a phone, a click elsewhere: Playwright sends the right events for the project.
        await (mobile ? open.tap() : open.click());
        await page.locator(".slots.times .slot").first().waitFor({ timeout: 20_000 });
        assert.ok((await page.locator(".slots.times .slot").count()) > 0, "no times were offered");
      },
    });
  });

  for (const [code, lang] of [
    ["es", "es-AR"],
    ["en", "en-GB"],
  ]) {
    test(`the language switch reaches ${code}`, { skip }, async () => {
      await visit("/", {
        native: true,
        body: async ({ page }) => {
          // The footer carries the switch at every width; the bar has a dropdown of its own.
          const link = page.locator(`footer .lang-switch a[hreflang="${code}"]`);
          assert.ok(await link.isVisible(), `the ${code} link is not reachable`);
          await Promise.all([page.waitForURL(new RegExp(`/${code}/?$`), { timeout: 30_000 }), mobile ? link.tap() : link.click()]);
          assert.equal(await page.locator("html").getAttribute("lang"), lang);
        },
      });
    });
  }

  test("from English the switch leads to German and Spanish, on the same page", { skip }, async () => {
    await visit("/en/karte", {
      native: true,
      body: async ({ page }) => {
        const hrefs = await page.locator("footer .lang-switch a").evaluateAll((els) => els.map((e) => e.getAttribute("href")));
        assert.deepEqual(hrefs.sort(), ["/es/karte", "/karte"]);
        assert.equal(await page.locator("footer .lang-switch [aria-current]").first().textContent(), "EN");
      },
    });
  });
});

describe(`${label}: phones`, () => {
  test("the menu button opens the navigation", { skip: skip || (mobile ? false : "not a phone project") }, async () => {
    await visit("/", {
      native: true,
      body: async ({ page }) => {
        const toggle = page.locator(".menu-toggle");
        if (!(await toggle.isVisible())) return; // a tablet wide enough for the full navigation
        await toggle.tap();
        assert.equal(await toggle.getAttribute("aria-expanded"), "true");
      },
    });
  });
});
