/**
 * House style, checked against what the browser actually paints.
 *
 * The site draws its own icons rather than borrowing the reader's operating system, because an
 * emoji is rendered by that system: the same page is a flat Twemoji on one machine and a glossy
 * 3D Apple glyph on another, at a size and weight nobody chose. Arrows were the last holdout —
 * U+2197 ↗ has an emoji presentation and iOS drew it in system blue next to a page of hand-drawn
 * line work.
 *
 * Source-grepping would not do: a `↑/↓` in a comment about keyboard handling is fine, and a `·`
 * in a template string is not. This reads the rendered text instead.
 */
import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import {
  BASE,
  closeBrowser,
  haveStaffCredentials,
  PUBLIC_PAGES,
  serverIsUp,
  STAFF_PAGES,
  visit,
} from "./harness.mjs";

const up = await serverIsUp();
const skip = up ? false : `no site at ${BASE}, run npm run dev`;
const skipStaff = up ? (haveStaffCredentials() ? false : "no STAFF_USER / STAFF_PASS") : `no site at ${BASE}`;
after(closeBrowser);

const ALL = [
  ...PUBLIC_PAGES.map(([name, path]) => [`public ${name}`, path, false]),
  ...STAFF_PAGES.map(([name, path]) => [`staff ${name}`, path, true]),
];

/** U+2190–U+21FF (arrows) and the dingbat arrows people reach for instead. A variation selector
 *  (U+FE0F) is deliberately not listed: on its own it belongs to any emoji, a guest's name included,
 *  and when it follows an arrow the arrow has already matched. */
const ARROWS = "[\\u2190-\\u21FF\\u27A1\\u2B05-\\u2B07]";

describe("arrows are drawn, not typed", () => {
  for (const [name, path, staff] of ALL) {
    test(name, { skip: staff ? skipStaff : skip }, async () => {
      await visit(path, {
        staff,
        body: async ({ page }) => {
          const found = await page.evaluate((pattern) => {
            const arrow = new RegExp(pattern);
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
            const out = [];
            for (let node = walker.nextNode(); node; node = walker.nextNode()) {
              // Next's development overlay is not part of the site.
              if (node.parentElement?.closest("nextjs-portal, [data-nextjs-toast], [data-next-badge-root]")) continue;
              if (arrow.test(node.textContent)) out.push(node.textContent.trim().slice(0, 50));
            }
            return [...new Set(out)];
          }, ARROWS);
          assert.deepEqual(found, [], "an arrow is set as a character rather than drawn");
        },
      });
    });
  }
});

describe("the drawn arrows render", () => {
  test("the home page's calls to action carry one each", { skip }, async () => {
    await visit("/", {
      body: async ({ page }) => {
        const buttons = page.locator(".hero-actions .button, .menu-more .button");
        const count = await buttons.count();
        assert.ok(count > 0, "no calls to action on the home page");
        for (let i = 0; i < count; i++) {
          assert.equal(await buttons.nth(i).locator("svg").count(), 1, "a call to action lost its arrow");
        }
      },
    });
  });

  test("they take the colour of the text they sit in", { skip }, async () => {
    await visit("/", {
      body: async ({ page }) => {
        const mismatched = await page.locator(".icon-inline").evaluateAll((els) =>
          els
            .filter((el) => getComputedStyle(el).stroke !== getComputedStyle(el.parentElement).color)
            .map((el) => el.parentElement.textContent.trim().slice(0, 30)),
        );
        assert.deepEqual(mismatched, []);
      },
    });
  });

  test("they sit on the text baseline rather than hanging off it", { skip }, async () => {
    await visit("/", {
      body: async ({ page }) => {
        const adrift = await page.locator(".review-open .icon-inline").evaluateAll((els) =>
          els
            .filter((el) => {
              const icon = el.getBoundingClientRect();
              const line = el.parentElement.getBoundingClientRect();
              // Inside the line box, give or take the descender it is allowed to dip into.
              return icon.top < line.top - 2 || icon.bottom > line.bottom + 2;
            })
            .map((el) => el.parentElement.textContent.trim().slice(0, 30)),
        );
        assert.deepEqual(adrift, []);
      },
    });
  });
});

describe("the Argentine flag is a flag", () => {
  // It stands in for the word "Argentinien" in the hero's first line, so a reader has to
  // recognise it. Drawn in currentColor it came out as a stroked box with two lines across it —
  // "Ein Stück ▤ in Frankfurt am Main" — which is the one icon on the site that cannot be
  // monochrome, because a flag is its colours.
  const pages = [
    ["German", "/", "Argentinien"],
    ["Spanish", "/es", "Argentina"],
  ];

  for (const [name, path, word] of pages) {
    test(`${name}: three bands and a sun, in the flag's own colours`, { skip }, async () => {
      await visit(path, {
        body: async ({ page }) => {
          const flag = page.locator(".eyebrow-text svg").first();
          await flag.waitFor();
          const fills = await flag.locator("[fill]").evaluateAll((els) =>
            els.map((el) => el.getAttribute("fill").toLowerCase()),
          );
          assert.ok(fills.includes("#74acdf"), "no celeste band");
          assert.ok(fills.includes("#fff") || fills.includes("#ffffff"), "no white band");
          assert.ok(fills.includes("#f6b40e"), "no Sol de Mayo");
        },
      });
    });

    test(`${name}: a screen reader hears the word it replaces`, { skip }, async () => {
      await visit(path, {
        body: async ({ page }) => {
          const flag = page.locator(".eyebrow-text svg").first();
          assert.equal(await flag.getAttribute("role"), "img");
          assert.equal((await flag.locator("title").textContent()).trim(), word);
          // Which makes the eyebrow a whole sentence again rather than one with a hole in it.
          const sentence = await page.locator(".eyebrow-text").first().innerText();
          assert.ok(sentence.length > 10, `the eyebrow reads "${sentence}"`);
        },
      });
    });
  }

  test("it keeps the official 9:14 proportions", { skip }, async () => {
    await visit("/", {
      body: async ({ page }) => {
        const box = await page.locator(".eyebrow-text svg").first().boundingBox();
        assert.ok(
          Math.abs(box.width / box.height - 14 / 9) < 0.02,
          `drawn at ${box.width.toFixed(1)}x${box.height.toFixed(1)}, which is not 9:14`,
        );
      },
    });
  });

  test("it does not sit flush against the next word", { skip }, async () => {
    await visit("/", {
      body: async ({ page }) => {
        const gap = await page.locator(".eyebrow-text svg").first().evaluate((el) => {
          const style = getComputedStyle(el);
          return Math.min(parseFloat(style.marginLeft), parseFloat(style.marginRight));
        });
        assert.ok(gap > 1, `the flag has ${gap}px of air beside it`);
      },
    });
  });
});
