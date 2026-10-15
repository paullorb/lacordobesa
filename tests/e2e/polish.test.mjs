/**
 * The finishing layer: the things that make the site feel made rather than assembled, checked
 * for the one way each of them can quietly break.
 *
 * The headline is split into a box per word so it can rise word by word; the risk is that it stops
 * reading as a sentence. The carta's index marks the category under the reader; the risk is that it
 * marks the wrong one, or nothing. The open menu is a page of its own; the risk is a panel that
 * stops short of the bottom of the screen and shows the page through the gap.
 */
import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { BASE, closeBrowser, serverIsUp, visit } from "./harness.mjs";

const up = await serverIsUp();
const skip = up ? false : `no site at ${BASE}, run npm run dev`;
after(closeBrowser);

describe("the headline still reads as a sentence", () => {
  for (const [path, first, second] of [
    ["/", "Wie zuhause.", "Con mucho amor."],
    ["/es", "Como en casa.", "Con mucho amor."],
    ["/en", "Just like home.", "Con mucho amor."],
  ]) {
    test(path, { skip }, async () => {
      await visit(path, {
        body: async ({ page }) => {
          const text = await page.locator("h1").innerText();
          assert.ok(text.includes(first), `the first line reads "${text}"`);
          assert.ok(text.includes(second), `the second line reads "${text}"`);
          // The accessible name is the words with their spaces, not the boxes run together.
          const name = await page.locator("h1").evaluate((el) => el.textContent.replace(/\s+/g, " ").trim());
          assert.ok(name.includes(first) && name.includes(second), `a screen reader hears "${name}"`);
        },
      });
    });
  }

  test("every word has its own box and no box clips its word", { skip }, async () => {
    await visit("/", {
      body: async ({ page }) => {
        const clipped = await page.locator(".hero-word").evaluateAll((els) =>
          els
            .filter((el) => {
              const inner = el.firstElementChild.getBoundingClientRect();
              const outer = el.getBoundingClientRect();
              return inner.top < outer.top - 0.5 || inner.bottom > outer.bottom + 0.5;
            })
            .map((el) => el.textContent),
        );
        assert.deepEqual(clipped, []);
        assert.ok((await page.locator(".hero-word").count()) >= 4, "the headline is not split into words");
      },
    });
  });
});

describe("the carta's index knows where the reader is", () => {
  test("the first category at the top, the second once it is reached", { skip }, async () => {
    await visit("/karte", {
      body: async ({ page }) => {
        // At the top the index is still in flow and the first category starts right under it.
        const first = await page.locator(".menu-cat").first().getAttribute("id");
        const atTop = page.locator(".menu-index a[aria-current]");
        assert.ok((await atTop.count()) <= 1, "more than one category is marked");
        if (await atTop.count()) assert.equal(await atTop.getAttribute("href"), `#${first}`);
        const slug = await page.locator(".menu-cat").nth(1).getAttribute("id");
        await page.evaluate((id) => document.getElementById(id).scrollIntoView(), slug);
        await page.waitForTimeout(250);
        const marked = page.locator(".menu-index a[aria-current='location']");
        assert.equal(await marked.count(), 1, "exactly one category should be marked");
        assert.equal(await marked.getAttribute("href"), `#${slug}`);
      },
    });
  });

  test("the marked chip is scrolled into view when the row overflows", { skip }, async () => {
    await visit("/karte", {
      width: 390,
      height: 844,
      body: async ({ page }) => {
        const last = page.locator(".menu-cat").last();
        const slug = await last.getAttribute("id");
        await page.evaluate((id) => document.getElementById(id).scrollIntoView(), slug);
        await page.waitForTimeout(400);
        const chip = page.locator(".menu-index a[aria-current='location']");
        assert.equal(await chip.getAttribute("href"), `#${slug}`);
        const box = await chip.boundingBox();
        assert.ok(box.x >= 0 && box.x + box.width <= 390, `the marked chip sits at x=${box.x}, outside the row`);
      },
    });
  });
});

describe("the open menu is a page of its own", () => {
  for (const [label, width, height] of [
    ["phone", 390, 844],
    ["laptop", 1280, 900],
  ]) {
    test(`at ${label} it reaches the bottom of the screen`, { skip }, async () => {
      await visit("/", {
        width,
        height,
        body: async ({ page }) => {
          await page.locator(".menu-toggle").click();
          const nav = page.locator("nav#navigation");
          await nav.waitFor({ state: "visible" });
          const box = await nav.boundingBox();
          assert.ok(box.y + box.height >= height - 1, `the panel ends at ${box.y + box.height}px on a ${height}px screen`);
          // The shop's details are in it, each a link with a drawn icon.
          const aside = nav.locator(".nav-aside a");
          assert.equal(await aside.count(), 3);
          for (let i = 0; i < 3; i++) assert.ok(await aside.nth(i).isVisible(), `contact link ${i} is hidden`);
        },
      });
    });
  }

  test("the desktop bar does not carry the contact block", { skip }, async () => {
    await visit("/", {
      width: 1440,
      body: async ({ page }) => {
        assert.equal(await page.locator(".nav-aside").isVisible(), false);
      },
    });
  });
});
