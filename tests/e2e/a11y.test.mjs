/**
 * Accessibility, measured rather than assumed.
 *
 * No axe-core: the checks that matter for this site are few and specific, and a measurement
 * written out in full says what it is testing and why. Contrast is computed here because a staff
 * calendar once rendered ink on ink and typechecking cannot see that.
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

describe("one heading says what the page is", () => {
  for (const [name, path, staff] of ALL) {
    test(name, { skip: staff ? skipStaff : skip }, async () => {
      await visit(path, {
        staff,
        body: async ({ page }) => {
          const headings = await page.locator("h1").allTextContents();
          assert.equal(headings.length, 1, `${path} has ${headings.length} h1s: ${JSON.stringify(headings)}`);
          assert.ok(headings[0].trim().length > 0, `${path} has an empty h1`);
        },
      });
    });
  }
});

describe("the heading outline has no gaps", () => {
  for (const [name, path, staff] of ALL) {
    test(name, { skip: staff ? skipStaff : skip }, async () => {
      await visit(path, {
        staff,
        body: async ({ page }) => {
          const levels = await page
            .locator("h1, h2, h3, h4, h5, h6")
            .evaluateAll((els) =>
              els
                .filter((el) => el.checkVisibility({ contentVisibilityAuto: true }))
                .map((el) => ({ level: Number(el.tagName[1]), text: el.textContent.trim().slice(0, 40) })),
            );
          const jumps = [];
          for (let i = 1; i < levels.length; i++) {
            if (levels[i].level - levels[i - 1].level > 1) {
              jumps.push(`h${levels[i - 1].level} "${levels[i - 1].text}" -> h${levels[i].level} "${levels[i].text}"`);
            }
          }
          assert.deepEqual(jumps, []);
        },
      });
    });
  }
});

describe("every control has a name a screen reader can read out", () => {
  for (const [name, path, staff] of ALL) {
    test(name, { skip: staff ? skipStaff : skip }, async () => {
      await visit(path, {
        staff,
        body: async ({ page }) => {
          const nameless = await page.evaluate(() => {
            const named = (el) => {
              if ((el.getAttribute("aria-label") ?? "").trim()) return true;
              const labelledBy = el.getAttribute("aria-labelledby");
              if (labelledBy && labelledBy.split(/\s+/).some((id) => document.getElementById(id))) return true;
              if (el.labels && el.labels.length > 0) return true;
              if ((el.textContent ?? "").trim()) return true;
              if ((el.getAttribute("title") ?? "").trim()) return true;
              return el.type === "hidden";
            };
            // A control a screen reader cannot reach and a keyboard cannot focus has no name to
            // read out. That is the `.picker-carrier` pattern (src/components/staff/pickers.tsx):
            // the real control is the button beside it, and this field only exists to carry the
            // value into the form, so it is aria-hidden and out of the tab order. Both halves are
            // required here on purpose: aria-hidden on something still tabbable *is* the bug this
            // test is for, so it stays reported.
            const inertToAT = (el) => el.closest('[aria-hidden="true"]') !== null && el.tabIndex < 0;
            return [...document.querySelectorAll("button, a[href], input, select, textarea")]
              .filter((el) => el.type !== "hidden")
              .filter((el) => el.checkVisibility({ contentVisibilityAuto: true }))
              .filter((el) => !inertToAT(el))
              .filter((el) => !named(el))
              .map((el) => el.outerHTML.slice(0, 90));
          });
          assert.deepEqual(nameless, []);
        },
      });
    });
  }
});

describe("every picture says what it is, or says it is decoration", () => {
  for (const [name, path, staff] of ALL) {
    test(name, { skip: staff ? skipStaff : skip }, async () => {
      await visit(path, {
        staff,
        body: async ({ page }) => {
          const missing = await page
            .locator("img")
            .evaluateAll((els) => els.filter((el) => el.getAttribute("alt") === null).map((el) => el.src.slice(-60)));
          assert.deepEqual(missing, []);
          // A drawn icon must be hidden from the reading order, or it is announced as "graphic".
          // Next's development overlay draws its own; it is not part of the site. It lives in a
          // shadow root (Playwright's locator pierces those, closest() does not), and the site has
          // no shadow DOM of its own, so anything outside the document is the overlay.
          const loudIcons = await page
            .locator("svg")
            .evaluateAll((els) =>
              els
                .filter((el) => el.getRootNode() === document)
                .filter((el) => !el.closest("nextjs-portal, [data-nextjs-toast], [data-next-badge-root], #__next-devtools"))
                .filter((el) => el.getAttribute("aria-hidden") !== "true" && !el.querySelector("title"))
                .filter((el) => !el.getAttribute("role") || el.getAttribute("role") === "img")
                .map((el) => el.outerHTML.slice(0, 70)),
            );
          assert.deepEqual(loudIcons, []);
        },
      });
    });
  }
});

describe("text is readable against what is behind it", () => {
  // WCAG 1.4.3 contrast minimum: 4.5:1 for body text, 3:1 for large text (24px, or 19px bold).
  const contrastCheck = () => {
    // The browser is the only thing that reliably turns every colour syntax into channels:
    // Tailwind v4 emits `color(srgb …)` and `color-mix(in oklab, …)`, and a regex over the
    // serialised string reads those as 1, 0, 0.
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const channels = (colour) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = "#000";
      context.fillStyle = colour;
      context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data];
    };
    const parse = (colour) => channels(colour).slice(0, 3);
    const alpha = (colour) => channels(colour)[3] / 255;
    const luminance = ([r, g, b]) =>
      [r, g, b]
        .map((c) => c / 255)
        .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
        .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
    const ratio = (a, b) => {
      const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (light + 0.05) / (dark + 0.05);
    };
    /** Text over a photo or a gradient: the colour behind it is not any ancestor's background,
     *  so there is nothing here that can judge it. The gallery captions sit on a scrim over the
     *  picture itself. A repeating SVG pattern is a texture over a solid colour, so it stays in. */
    const overArtwork = (el) => {
      for (let node = el; node; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (style.backgroundImage !== "none" && !style.backgroundImage.startsWith('url("data:image/svg')) return true;
        if (alpha(style.backgroundColor) > 0.5) return false;
      }
      return false;
    };

    /** The first ancestor that actually paints something. */
    const behind = (el) => {
      for (let node = el; node; node = node.parentElement) {
        const background = getComputedStyle(node).backgroundColor;
        if (alpha(background) > 0.5) return parse(background);
      }
      return [255, 255, 255];
    };

    const bad = [];
    for (const el of document.querySelectorAll("body *")) {
      const text = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
      if (!text || !el.checkVisibility({ contentVisibilityAuto: true, opacityProperty: true })) continue;
      const style = getComputedStyle(el);
      if (style.clipPath.startsWith("inset(50%")) continue;
      if (overArtwork(el)) continue;
      const colour = parse(style.color);
      if (!colour || alpha(style.color) < 0.9) continue;
      const size = parseFloat(style.fontSize);
      const large = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700);
      const needed = large ? 3 : 4.5;
      const measured = ratio(colour, behind(el));
      if (measured + 0.05 < needed) {
        bad.push(
          `${el.tagName.toLowerCase()}.${(el.getAttribute("class") ?? "").slice(0, 30)} ` +
            `${measured.toFixed(2)}:1 needs ${needed}:1 — "${el.textContent.trim().slice(0, 30)}"`,
        );
      }
    }
    return [...new Set(bad)].slice(0, 10);
  };

  for (const [name, path, staff] of ALL) {
    test(name, { skip: staff ? skipStaff : skip }, async () => {
      await visit(path, {
        staff,
        body: async ({ page }) => {
          assert.deepEqual(await page.evaluate(contrastCheck), []);
        },
      });
    });
  }
});

describe("the keyboard can get everywhere", () => {
  test("the public site opens with a skip link", { skip }, async () => {
    await visit("/", {
      body: async ({ page }) => {
        await page.keyboard.press("Tab");
        const focused = await page.evaluate(() => ({
          tag: document.activeElement.tagName.toLowerCase(),
          text: document.activeElement.textContent.trim(),
          href: document.activeElement.getAttribute("href"),
        }));
        assert.equal(focused.tag, "a");
        assert.equal(focused.href, "#main");
      },
    });
  });

  test("the skip link becomes visible when it is focused", { skip }, async () => {
    await visit("/", {
      body: async ({ page }) => {
        await page.keyboard.press("Tab");
        const box = await page.locator(".skip-link").boundingBox();
        assert.ok(box.width > 40 && box.height > 20, `the focused skip link is ${box.width}x${box.height}`);
      },
    });
  });

  test("it lands on the main content", { skip }, async () => {
    await visit("/", {
      body: async ({ page }) => {
        assert.equal(await page.locator("#main").count(), 1);
      },
    });
  });

  test("focus is visible on the staff area's controls", { skip: skipStaff }, async () => {
    await visit("/staff/oeffnungszeiten", {
      staff: true,
      body: async ({ page }) => {
        await page.locator("#cl-from").focus();
        const outline = await page.locator("#cl-from").evaluate((el) => {
          const style = getComputedStyle(el);
          return { width: style.outlineWidth, style: style.outlineStyle, shadow: style.boxShadow };
        });
        const visible = parseFloat(outline.width) > 0 && outline.style !== "none";
        assert.ok(visible || outline.shadow !== "none", "a focused field shows nothing");
      },
    });
  });

  test("the menu button announces whether the menu is open", { skip }, async () => {
    await visit("/", {
      width: 390,
      body: async ({ page }) => {
        const toggle = page.locator(".menu-toggle");
        assert.equal(await toggle.getAttribute("aria-expanded"), "false");
        await toggle.click();
        assert.equal(await toggle.getAttribute("aria-expanded"), "true");
        assert.equal(await toggle.getAttribute("aria-controls"), "navigation");
      },
    });
  });
});

describe("the landmarks are there", () => {
  for (const [name, path, staff] of ALL) {
    test(name, { skip: staff ? skipStaff : skip }, async () => {
      await visit(path, {
        staff,
        body: async ({ page }) => {
          assert.equal(await page.locator("main").count(), 1, `${path} has no single main`);
          const navs = await page.locator("nav").evaluateAll((els) =>
            els.filter((el) => el.checkVisibility({ contentVisibilityAuto: true })),
          );
          // Several navs on a page need telling apart.
          if (navs.length > 1) {
            const unnamed = await page
              .locator("nav")
              .evaluateAll((els) =>
                els
                  .filter((el) => el.checkVisibility({ contentVisibilityAuto: true }))
                  .filter((el) => !el.getAttribute("aria-label") && !el.getAttribute("aria-labelledby")).length,
              );
            assert.ok(unnamed <= 1, `${path} has ${unnamed} unlabelled navs`);
          }
        },
      });
    });
  }
});
