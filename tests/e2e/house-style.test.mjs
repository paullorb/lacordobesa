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
        // The menu panel's icons are blue on purpose (.nav-icon), the text beside them is ink.
        const mismatched = await page.locator(".icon-inline:not(.nav-icon)").evaluateAll((els) =>
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

describe("the hero eyebrow keeps its localised copy", () => {
  const pages = [
    ["German", "/", "Wie zuhause. Con mucho amor."],
    ["Spanish", "/es", "Como en casa. Con mucho amor."],
    ["English", "/en", "Like home. Made with love."],
  ];

  for (const [name, path, copy] of pages) {
    test(name, { skip }, async () => {
      await visit(path, {
        body: async ({ page }) => {
          assert.equal((await page.locator(".eyebrow-text").innerText()).trim().toLocaleLowerCase(), copy.toLocaleLowerCase());
        },
      });
    });
  }
});

describe("no em or en dashes in the copy", () => {
  // A standing rule for the site's text. Dish names and guest content are data, so the check is on
  // the pages that carry only the dictionaries.
  for (const [name, path] of [
    ["German home", "/"],
    ["Spanish home", "/es"],
    ["English home", "/en"],
    ["English menu", "/en/karte"],
    ["English preorder", "/en/vorbestellen"],
    ["English catering", "/en/catering"],
  ]) {
    test(name, { skip }, async () => {
      await visit(path, {
        body: async ({ page }) => {
          const found = await page.evaluate(() => {
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
            const out = [];
            for (let node = walker.nextNode(); node; node = walker.nextNode()) {
              if (node.parentElement?.closest("nextjs-portal, [data-nextjs-toast], [data-next-badge-root], script, style")) continue;
              if (/[–—]/.test(node.textContent)) out.push(node.textContent.trim().slice(0, 60));
            }
            return [...new Set(out)];
          });
          assert.deepEqual(found, []);
        },
      });
    });
  }
});
