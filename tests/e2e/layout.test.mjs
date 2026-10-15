/**
 * Does every page fit on the screen it is read on?
 *
 * This file exists because of a bug report with photographs attached: on an iPhone the staff menu
 * editor rendered with the navbar stopping two thirds of the way across, the body cut off at both
 * edges, and the whole page apparently zoomed in. All three were one symptom. The page was 667 CSS
 * px wide inside a 390 px viewport, Safari widened the layout viewport to fit and scaled up, and
 * the fixed-width chrome stayed at device width while the content ran past it.
 *
 * Chromium shows the same overflow as a sideways scrollbar nobody notices on a laptop, so the
 * check is a measurement rather than a screenshot.
 */
import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import {
  clippedText,
  closeBrowser,
  describeOverflow,
  haveStaffCredentials,
  horizontalOverflow,
  PUBLIC_PAGES,
  serverIsUp,
  STAFF_PAGES,
  safari,
  staffStorageState,
  tapTargets,
  undersizedTargets,
  visit,
  visitOnPhone,
  WIDTHS,
  BASE,
} from "./harness.mjs";

// Checked at load time, not in a `before` hook: `test(..., { skip })` reads the option the moment
// the test is declared, so a hook would always be too late and every test would skip.
const up = await serverIsUp();
after(closeBrowser);

const skipUnlessServing = () => (up ? false : `no site at ${BASE}, run npm run dev`);
const skipUnlessStaff = () => skipUnlessServing() || (haveStaffCredentials() ? false : "no STAFF_USER / STAFF_PASS");

describe("public pages fit the screen", () => {
  for (const [name, path] of PUBLIC_PAGES) {
    for (const [label, width, height] of WIDTHS) {
      test(`${name} at ${label} (${width}px)`, { skip: skipUnlessServing() }, async () => {
        await visit(path, {
          width,
          height,
          body: async ({ page, response }) => {
            assert.ok(response.status() < 400, `${path} answered ${response.status()}`);
            const result = await horizontalOverflow(page);
            assert.equal(result.overflow, 0, `${path} overflows sideways: ${describeOverflow(result)}`);
          },
        });
      });
    }
  }
});

describe("staff pages fit the screen", () => {
  for (const [name, path] of STAFF_PAGES) {
    for (const [label, width, height] of WIDTHS) {
      test(`${name} at ${label} (${width}px)`, { skip: skipUnlessStaff() }, async () => {
        await visit(path, {
          width,
          height,
          staff: true,
          body: async ({ page, response }) => {
            assert.ok(response.status() < 400, `${path} answered ${response.status()}`);
            const result = await horizontalOverflow(page);
            assert.equal(result.overflow, 0, `${path} overflows sideways: ${describeOverflow(result)}`);
          },
        });
      });
    }
  }
});

describe("the page chrome spans the window", () => {
  // The giveaway in the bug report: a white header band that stopped before the right edge while
  // the dish rows carried on past it. A sticky header is as wide as the body, so it only looks
  // like that when the body is narrower than the content inside it.
  const headers = [
    ["public", "/", "header", false],
    ["staff", "/staff/karte", ".staff > header", true],
  ];

  for (const [name, path, selector, staff] of headers) {
    test(`${name} header reaches both edges on a phone`, { skip: staff ? skipUnlessStaff() : skipUnlessServing() }, async () => {
      await visitOnPhone(path, {
        staff,
        body: async ({ page }) => {
          const box = await page.locator(selector).first().boundingBox();
          const viewport = page.viewportSize().width;
          assert.ok(box, `${selector} not found on ${path}`);
          assert.equal(Math.round(box.x), 0, "header does not start at the left edge");
          assert.ok(
            Math.abs(box.width - viewport) <= 1,
            `header is ${Math.round(box.width)}px wide in a ${viewport}px window`,
          );
        },
      });
    });
  }
});

/**
 * Drops `upgrade-insecure-requests` from the page's CSP, for WebKit only.
 *
 * WebKit applies that directive to `http://localhost` as well, so every stylesheet, font and
 * script on this server is rewritten to `https://localhost:3000` and dies with a TLS error. The
 * page then renders with no CSS at all, which measures as 448px of content in 390px and reads as
 * a layout bug: it was four of them. Chromium exempts localhost from the upgrade, which is why
 * only the Safari tests saw it.
 *
 * Nothing to fix in the site. The header is right, and over HTTPS in production the directive has
 * nothing left to upgrade; it only bites a plain-HTTP origin, which is exactly what a local server
 * is and a deployment never is.
 */
async function allowPlainHttp(context) {
  await context.route("**/*", async (route) => {
    if (route.request().resourceType() !== "document") return route.continue();
    const response = await route.fetch();
    const headers = { ...response.headers() };
    const csp = headers["content-security-policy"];
    if (csp) {
      headers["content-security-policy"] = csp
        .split(";")
        .map((directive) => directive.trim())
        .filter((directive) => directive !== "upgrade-insecure-requests")
        .join("; ");
    }
    await route.fulfill({ response, headers });
  });
}

describe("Safari does not scale the page to fit", () => {
  // The same overflow, seen the way the team sees it. WebKit widens its layout viewport when the
  // content does not fit, which is the "zoomed in" screen in the report: visualViewport.scale
  // stays 1 but the layout viewport grows past the device width.
  const pages = [
    ["home", "/", false],
    ["staff today", "/staff", true],
    ["staff menu", "/staff/karte", true],
    ["staff hours", "/staff/oeffnungszeiten", true],
  ];

  for (const [name, path, staff] of pages) {
    test(name, { skip: staff ? skipUnlessStaff() : skipUnlessServing() }, async () => {
      const browser = await safari();
      try {
        const context = await browser.newContext({
          viewport: { width: 390, height: 844 },
          deviceScaleFactor: 3,
          isMobile: true,
          hasTouch: true,
          storageState: staff ? await staffStorageState() : undefined,
          reducedMotion: "reduce",
        });
        await allowPlainHttp(context);
        const page = await context.newPage();
        await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 90_000 });
        const measured = await page.evaluate(() => ({
          layoutWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          bodyWidth: Math.round(document.body.getBoundingClientRect().width),
        }));
        assert.equal(
          measured.scrollWidth,
          measured.layoutWidth,
          `${path}: ${measured.scrollWidth}px of content in ${measured.layoutWidth}px`,
        );
        assert.equal(measured.bodyWidth, measured.layoutWidth, `${path}: body is narrower than the viewport`);
        await context.close();
      } finally {
        await browser.close();
      }
    });
  }
});

describe("form fields do not make iOS zoom in", () => {
  // iOS Safari zooms into a focused field whose text is under 16px, and does not zoom back out when
  // the form is submitted: the log in screen stayed magnified before and after signing in.
  const pages = [
    ["staff log in", "/staff/login", false],
    ["staff reservations", "/staff/reservierungen", true],
    ["staff menu", "/staff/karte", true],
    ["staff hours", "/staff/oeffnungszeiten", true],
    ["home", "/", false],
    ["catering", "/catering", false],
  ];

  for (const [name, path, staff] of pages) {
    test(name, { skip: staff ? skipUnlessStaff() : skipUnlessServing() }, async () => {
      await visitOnPhone(path, {
        staff,
        body: async ({ page }) => {
          const small = await page.evaluate(() =>
            [...document.querySelectorAll("input, select, textarea")]
              .filter((el) => !["hidden", "checkbox", "radio", "file", "range", "color"].includes(el.type))
              .filter((el) => el.getBoundingClientRect().width > 0)
              .map((el) => ({ el: `${el.tagName.toLowerCase()}#${el.id || el.name}`, size: parseFloat(getComputedStyle(el).fontSize) }))
              .filter((f) => f.size < 16)
              .map((f) => `${f.el} ${f.size}px`),
          );
          assert.deepEqual(small, [], `${path} has fields under 16px`);
        },
      });
    });
  }
});

describe("the staff navigation is reachable on a phone", () => {
  // Two tabs used to sit off the right edge of a sideways-scrolling strip with nothing on screen
  // to say they were there, and iOS draws no scrollbar to hint at it. Einstellungen was one of them.
  test("every tab is inside the window", { skip: skipUnlessStaff() }, async () => {
    await visitOnPhone("/staff", {
      staff: true,
      body: async ({ page }) => {
        const viewport = page.viewportSize().width;
        const tabs = await page.locator('nav[aria-label="Bereiche"] a').all();
        assert.ok(tabs.length >= 6, "expected the six area tabs");
        for (const tab of tabs) {
          const box = await tab.boundingBox();
          const label = (await tab.textContent()).trim();
          assert.ok(box.x >= -1, `"${label}" starts off the left edge`);
          assert.ok(box.x + box.width <= viewport + 1, `"${label}" runs past the right edge`);
        }
      },
    });
  });

  test("Einstellungen can be tapped", { skip: skipUnlessStaff() }, async () => {
    await visitOnPhone("/staff", {
      staff: true,
      body: async ({ page }) => {
        await page.getByRole("link", { name: "Einstellungen", exact: true }).click();
        await page.waitForURL(/\/staff\/einstellungen$/, { timeout: 30_000 });
      },
    });
  });

  test("the sub-navigation of the open area is visible too", { skip: skipUnlessStaff() }, async () => {
    await visitOnPhone("/staff/karte", {
      staff: true,
      body: async ({ page }) => {
        const viewport = page.viewportSize().width;
        const links = await page.locator('nav[aria-label="Inhalte"] a').all();
        assert.equal(links.length, 5, "Karte, Specials, Galerie, Öffnungszeiten, Bewertungen");
        for (const link of links) {
          const box = await link.boundingBox();
          assert.ok(box.x + box.width <= viewport + 1, `"${(await link.textContent()).trim()}" runs off the screen`);
        }
      },
    });
  });
});

describe("tap targets are big enough for a thumb", () => {
  // WCAG 2.2 Target Size (Minimum), level AA: 24px, with the criterion's own spacing exception, so
  // a link at its natural line height with room around it passes and a cramped cluster of small
  // controls does not. Not the 44px of level AAA: the staff lists are dense on purpose.
  const MINIMUM = 24;
  const pages = [
    ["home", "/", false],
    ["menu", "/karte", false],
    ["catering", "/catering", false],
    ["staff today", "/staff", true],
    ["staff menu", "/staff/karte", true],
  ];

  for (const [name, path, staff] of pages) {
    test(name, { skip: staff ? skipUnlessStaff() : skipUnlessServing() }, async () => {
      await visitOnPhone(path, {
        staff,
        body: async ({ page }) => {
          const small = undersizedTargets(await tapTargets(page), MINIMUM);
          assert.deepEqual(
            small.map((t) => `${t.tag} "${t.label}" ${t.width}x${t.height}`),
            [],
            `${path} has targets under ${MINIMUM}px`,
          );
        },
      });
    });
  }
});

describe("nothing renders on top of itself", () => {
  // A heading clipped by its own box is how "cropped UI" shows up when the overflow is vertical
  // rather than horizontal: the text is there in the DOM and simply not on the screen.
  const pages = [
    ["home", "/", false],
    ["menu", "/karte", false],
    ["staff menu", "/staff/karte", true],
    ["staff hours", "/staff/oeffnungszeiten", true],
  ];

  for (const [name, path, staff] of pages) {
    test(name, { skip: staff ? skipUnlessStaff() : skipUnlessServing() }, async () => {
      await visitOnPhone(path, {
        staff,
        body: async ({ page }) => {
          assert.deepEqual(await clippedText(page), []);
        },
      });
    });
  }
});
