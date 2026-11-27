/**
 * The FLIP layer: the two places where a list reorders or a grid refilters and the rows have to be
 * followed from where they were to where they land.
 *
 * Everything else about the site's motion is CSS, and the rest of this suite runs with
 * `reducedMotion: "reduce"` on purpose, so nothing here would be exercised by any other file.
 * These tests ask for motion explicitly.
 *
 * What is actually worth pinning down is not "does it look nice" but the two promises the
 * enhancement makes:
 *
 *  - the reorder still happens when the animation does not, so nobody loses a feature to it;
 *  - somebody who asked for less movement gets none.
 */
import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { BASE, closeBrowser, haveStaffCredentials, serverIsUp, startArranging, visit } from "./harness.mjs";

const up = await serverIsUp();
const skip = up ? false : `no site at ${BASE}, run npm run dev`;
const skipStaff = up ? (haveStaffCredentials() ? false : "no STAFF_USER / STAFF_PASS") : `no site at ${BASE}`;
after(closeBrowser);

/** Transforms of every element matching `selector`, as the browser computes them. */
const transformsOf = (page, selector) =>
  page.locator(selector).evaluateAll((els) => els.map((el) => getComputedStyle(el).transform));

describe("the gallery refilters by moving the photos", () => {
  test("surviving tiles glide and arriving tiles fade up", { skip }, async () => {
    await visit("/gallery", {
      motion: true,
      body: async ({ page, errors }) => {
        await page.waitForTimeout(2500); // the lazy chunk
        const chips = page.locator(".gallery-filters .chip");
        if ((await chips.count()) < 2) return; // the local gallery with one category proves nothing

        // Narrow to a category, then widen back to all: that way tiles both leave and arrive.
        await chips.nth(1).click();
        await page.waitForTimeout(900);
        const narrowed = await page.locator(".gallery-grid > li").count();

        await chips.nth(0).click();
        await page.waitForTimeout(90); // mid-glide
        const mid = await transformsOf(page, ".gallery-grid > li");
        const widened = mid.length;
        assert.ok(widened > narrowed, `refiltering to all showed ${widened}, not more than ${narrowed}`);
        assert.ok(
          mid.some((t) => t !== "none"),
          "no tile is transformed mid-refilter, so the grid teleported",
        );

        // And it has to end clean: a tile left under a transform is a tile in the wrong place.
        await page.waitForTimeout(1200);
        const settled = await transformsOf(page, ".gallery-grid > li");
        assert.deepEqual(
          settled.filter((t) => t !== "none" && t !== "matrix(1, 0, 0, 1, 0, 0)"),
          [],
          "a tile is still transformed after the animation finished",
        );
        assert.deepEqual(errors, []);
      },
    });
  });

  test("the lightbox grows out of the tile and lands square", { skip }, async () => {
    await visit("/gallery", {
      motion: true,
      body: async ({ page }) => {
        await page.waitForTimeout(2500);
        if ((await page.locator(".gallery-tile").count()) === 0) return;
        await page.locator(".gallery-tile").first().click();
        await page.waitForTimeout(70);
        const mid = await page.locator(".lightbox-image").evaluate((el) => getComputedStyle(el).transform);
        assert.notEqual(mid, "none", "the lightbox image appeared at full size instead of growing from the tile");
        await page.waitForTimeout(900);
        const settled = await page.locator(".lightbox-image").evaluate((el) => getComputedStyle(el).transform);
        assert.equal(settled, "none", "the lightbox image kept the transform it was opened with");
      },
    });
  });

  test("asking for less movement refilters instantly", { skip }, async () => {
    await visit("/gallery", {
      body: async ({ page }) => {
        const chips = page.locator(".gallery-filters .chip");
        if ((await chips.count()) < 2) return;
        const before = await page.locator(".gallery-grid > li").count();
        await chips.nth(1).click();
        await page.waitForTimeout(120);
        const transforms = await transformsOf(page, ".gallery-grid > li");
        assert.deepEqual(
          transforms.filter((t) => t !== "none"),
          [],
          "a tile animated for a reader who asked for reduced motion",
        );
        // The filter still has to work; this is an enhancement, not the feature.
        assert.equal(await chips.nth(1).getAttribute("aria-pressed"), "true", "the chip did not take");
        const after = await page.locator(".gallery-grid > li").count();
        assert.ok(after > 0 && after <= before, `filtering showed ${after} tiles out of ${before}`);
      },
    });
  });
});

describe("the staff menu arranger moves the rows it reorders", () => {
  const order = (page) =>
    page.locator("[data-arrange-item]").evaluateAll((els) => els.map((e) => e.dataset.flipId));

  /**
   * Reordering saves, and this suite does not write to the local database: a reordered menu would outlive the
   * test run and is the shop's real carta.
   *
   * The Server Action is a POST to the page's own URL, so the POST is held open and never answered.
   * Not aborted: a refused action *fails*, and the arranger answers a failure by gliding every row
   * back where it came from, which races this test and wins. Left hanging, the optimistic reorder
   * stands, the glide is the only thing moving, and the database is never touched.
   */
  const holdWrites = (page) =>
    page.route("**/*", (route) => {
      if (route.request().method() === "POST") return; // never answered, so never saved
      return route.continue();
    });

  test("a keypress glides only the rows that actually moved", { skip: skipStaff }, async () => {
    await visit("/staff/karte", {
      staff: true,
      motion: true,
      body: async ({ page }) => {
        await page.waitForTimeout(2500);
        await startArranging(page);
        const handles = page.locator("[data-arrange-item] [data-handle]");
        if ((await handles.count()) < 2) return;
        await holdWrites(page);

        const before = await order(page);
        await handles.first().focus();
        await page.keyboard.press("ArrowDown");
        // `relayout` commits with flushSync, so the new order is in the DOM by the time the
        // keypress has been dispatched, and the held save means nothing will put it back.
        assert.notDeepEqual(await order(page), before, "the keypress did not reorder anything");

        await page.waitForTimeout(60); // mid-glide
        const moving = (await transformsOf(page, "[data-arrange-item]")).filter((t) => t !== "none");
        assert.ok(moving.length > 0, "nothing moved: the rows swapped places by teleporting");
        // `prune` is the point. On a 60-dish menu, a one-step swap must animate the two rows that
        // changed place and leave the rest alone, or every keypress repaints the whole page.
        assert.ok(moving.length <= 4, `${moving.length} rows animated for a one-step swap`);

        await page.waitForTimeout(1500);
        assert.deepEqual(
          (await transformsOf(page, "[data-arrange-item]")).filter((t) => t !== "none"),
          [],
          "a row kept its transform after settling",
        );
      },
    });
  });

  test("with reduced motion the same keypress reorders and animates nothing", { skip: skipStaff }, async () => {
    await visit("/staff/karte", {
      staff: true,
      body: async ({ page }) => {
        await startArranging(page);
        const handles = page.locator("[data-arrange-item] [data-handle]");
        if ((await handles.count()) < 2) return;
        await holdWrites(page);
        const before = await order(page);
        await handles.first().focus();
        await page.keyboard.press("ArrowDown");
        // No flushSync on this path, so React commits whenever it likes: wait before reading.
        await page.waitForTimeout(150);
        assert.notDeepEqual(await order(page), before, "the reorder itself stopped working");
        assert.deepEqual(
          (await transformsOf(page, "[data-arrange-item]")).filter((t) => t !== "none"),
          [],
          "a row animated for a reader who asked for reduced motion",
        );
      },
    });
  });
});
