/**
 * The installable staff app, as far as a script can check it (issue #104).
 *
 * The team adds /staff to the home screen. What a script can verify is the contract the browser
 * reads when it decides that is possible (manifest, icons, scope, theme colour) and how the pages
 * behave once the page believes it is installed (`display-mode: standalone`, and
 * `navigator.standalone` on iOS). What it cannot verify is the installed window itself: the missing
 * browser chrome, the status-bar inset on a notched iPhone, the app switcher, the install prompt.
 * Those need a phone in a hand, and tests/README.md lists them as such.
 *
 * Nothing here signs in and nothing is submitted.
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
  serverIsUp,
  visit,
} from "./harness.mjs";

const up = await serverIsUp();
after(closeBrowser);
const skip = up ? false : `no site at ${BASE}, run npm run dev`;
const { label, mobile } = PROJECTS[PROJECT];

/** Width and height from a PNG's IHDR chunk, so an icon is checked for what it is and not for what
 *  the manifest says it is. */
const pngSize = (bytes) => ({ width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) });

describe(`${label}: the manifest`, () => {
  /** @type {any} */
  let manifest;
  const load = async () => {
    if (manifest) return manifest;
    const response = await fetch(`${BASE}/manifest.webmanifest`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /json/);
    manifest = await response.json();
    return manifest;
  };

  test("opens the staff area as an app", { skip }, async () => {
    const m = await load();
    assert.equal(m.display, "standalone");
    assert.equal(m.start_url, "/staff");
    assert.equal(m.scope, "/staff");
    assert.ok(m.name && m.short_name, "name and short_name are what the home screen shows");
    assert.match(m.theme_color, /^#[0-9a-f]{6}$/i);
    assert.match(m.background_color, /^#[0-9a-f]{6}$/i);
  });

  test("starts inside its own scope", { skip }, async () => {
    const m = await load();
    assert.ok(m.start_url === m.scope || m.start_url.startsWith(`${m.scope}/`), "start_url is outside scope");
  });

  test("has icons that exist and are the size they claim", { skip }, async () => {
    const m = await load();
    const sizes = new Set();
    for (const icon of m.icons) {
      const response = await fetch(new URL(icon.src, BASE));
      assert.equal(response.status, 200, `${icon.src} answered ${response.status}`);
      assert.equal(response.headers.get("content-type"), "image/png");
      const { width, height } = pngSize(Buffer.from(await response.arrayBuffer()));
      assert.equal(`${width}x${height}`, icon.sizes, `${icon.src} is ${width}x${height}, the manifest says ${icon.sizes}`);
      sizes.add(`${icon.sizes}:${icon.purpose ?? "any"}`);
    }
    // What installability asks for: a 192 and a 512, and a maskable one for Android's round icons.
    assert.ok(sizes.has("192x192:any") || sizes.has("192x192:maskable"), "no 192px icon");
    assert.ok(sizes.has("512x512:any"), "no 512px icon");
    assert.ok(sizes.has("512x512:maskable"), "no maskable icon");
  });
});

describe(`${label}: the pages advertise it where they should`, () => {
  test("the staff pages link the manifest, the theme colour and the iOS icon", { skip }, async () => {
    await visit("/staff/login", {
      native: true,
      body: async ({ page }) => {
        assert.equal(await page.locator('link[rel="manifest"]').getAttribute("href"), "/manifest.webmanifest");
        assert.ok(await page.locator('meta[name="theme-color"]').count(), "no theme-color");
        const touch = await page.locator('link[rel="apple-touch-icon"]').getAttribute("href");
        assert.ok(touch, "iOS has no home screen icon");
        const response = await page.request.get(new URL(touch, BASE).toString());
        const { width, height } = pngSize(Buffer.from(await response.body()));
        assert.equal(width, 180, "iOS expects a 180px touch icon");
        assert.equal(height, 180);
      },
    });
  });

  test("the public pages do not offer an app whose scope does not contain them", { skip }, async () => {
    await visit("/", {
      native: true,
      body: async ({ page }) => {
        assert.equal(await page.locator('link[rel="manifest"]').count(), 0);
      },
    });
  });

  test("the offline fallback is served without a session", { skip }, async () => {
    const response = await fetch(`${BASE}/staff/offline`, { redirect: "manual" });
    assert.equal(response.status, 200, "the service worker precaches this page while logged out");
  });
});

describe(`${label}: once installed (display-mode: standalone)`, () => {
  // The same pages with the page convinced it is a home screen app. Nothing in the source branches
  // on standalone today, so these are guard rails: they fail the day somebody adds a standalone
  // rule (safe-area padding, a hidden header) and gets it wrong, in an engine they did not try.
  const pages = [
    ["the staff login", "/staff/login"],
    ["the offline page", "/staff/offline"],
    ["the public home page", "/"],
  ];

  for (const [name, path] of pages) {
    test(`${name} still fits and stays quiet`, { skip }, async () => {
      await visit(path, {
        native: true,
        standalone: true,
        body: async ({ page, response, errors }) => {
          assert.ok(response.status() < 400, `${path} answered ${response.status()}`);
          assert.equal(await page.evaluate(() => matchMedia("(display-mode: standalone)").matches), true);
          assert.equal(await page.evaluate(() => navigator.standalone), true);
          const result = await horizontalOverflow(page);
          assert.equal(result.overflow, 0, `${path} overflows sideways: ${describeOverflow(result)}`);
          await page.waitForTimeout(300);
          assert.deepEqual(errors, []);
        },
      });
    });
  }

  test("the staff header spans the window", { skip }, async () => {
    await visit("/staff/login", {
      native: true,
      standalone: true,
      body: async ({ page }) => {
        const box = await page.locator(".staff > header").boundingBox();
        const viewport = page.viewportSize().width;
        assert.ok(box && Math.round(box.x) === 0 && Math.abs(box.width - viewport) <= 1, "the header does not span the window");
      },
    });
  });

  test("there is no safe-area handling to get wrong, or it is right", { skip: skip || (mobile ? false : "not a phone project") }, async () => {
    // Without `viewport-fit=cover` a notched iPhone insets the page itself and no CSS is needed.
    // If somebody adds the cover value, they own the env(safe-area-inset-*) padding as well.
    await visit("/staff/login", {
      native: true,
      standalone: true,
      body: async ({ page }) => {
        const viewport = (await page.locator('meta[name="viewport"]').getAttribute("content")) ?? "";
        if (!/viewport-fit\s*=\s*cover/.test(viewport)) return;
        const usesInsets = await page.evaluate(() =>
          [...document.styleSheets].some((sheet) => {
            try {
              return [...sheet.cssRules].some((rule) => rule.cssText.includes("safe-area-inset"));
            } catch {
              return false;
            }
          }),
        );
        assert.ok(usesInsets, "viewport-fit=cover without any safe-area-inset padding puts content under the notch");
      },
    });
  });
});
