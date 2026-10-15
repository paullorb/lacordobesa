/**
 * Performance, measured as structure rather than as stopwatch numbers.
 *
 * A dev server is unminified, recompiles on demand and serves source maps, so a byte or
 * millisecond budget taken here would mean nothing. What does hold in development is the shape of
 * the page: how many images shift the layout when they arrive, whether a font is fetched from
 * another origin, how many requests a page makes, how big the DOM is. Those are the decisions,
 * and they are the ones a change can quietly undo.
 *
 * The weight budgets are the exception and only run against a production build:
 *
 *   npm run build && npm start
 *   E2E_PRODUCTION=1 npm run test:e2e
 */
import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import {
  BASE,
  closeBrowser,
  haveStaffCredentials,
  PRODUCTION_BUILD,
  PUBLIC_PAGES,
  serverIsUp,
  visit,
} from "./harness.mjs";

const up = await serverIsUp();
const skip = up ? false : `no site at ${BASE}, run npm run dev`;
const skipStaff = up ? (haveStaffCredentials() ? false : "no STAFF_USER / STAFF_PASS") : `no site at ${BASE}`;
const skipUnlessBuilt = skip || (PRODUCTION_BUILD ? false : "set E2E_PRODUCTION=1 against next start");
after(closeBrowser);

const MAIN_PAGES = ["/", "/karte", "/vorbestellen", "/catering", "/gallery"];

/** Records every request a page makes, with its origin and size. */
function trackRequests(page) {
  const requests = [];
  page.on("response", (response) => {
    requests.push({
      url: response.url(),
      status: response.status(),
      type: response.request().resourceType(),
      origin: new URL(response.url()).origin,
    });
  });
  return requests;
}

describe("nothing is fetched from another origin", () => {
  // The fonts are self-hosted at build time and the Instagram pictures go through next/image, so
  // the browser only ever talks to this site. The CSP says so too; this checks the page agrees.
  for (const path of MAIN_PAGES) {
    test(path, { skip }, async () => {
      await visit(path, {
        body: async ({ page }) => {
          const requests = trackRequests(page);
          await page.reload({ waitUntil: "networkidle" });
          const foreign = [...new Set(requests.map((r) => r.origin))].filter((origin) => origin !== BASE);
          assert.deepEqual(foreign, [], `${path} talks to another origin`);
        },
      });
    });
  }
});

describe("fonts", () => {
  test("come from here, not from Google", { skip }, async () => {
    await visit("/", {
      body: async ({ page }) => {
        const requests = trackRequests(page);
        await page.reload({ waitUntil: "networkidle" });
        const google = requests.filter((r) => /fonts\.(googleapis|gstatic)\.com/.test(r.url));
        assert.deepEqual(google, []);
      },
    });
  });

  test("are two families and no more", { skip }, async () => {
    // One serif, one sans. Each extra weight is another file on the critical path.
    await visit("/", {
      body: async ({ page }) => {
        const families = await page.evaluate(() =>
          [...new Set([...document.fonts].map((f) => f.family))]
            // next/font registers a metric-matched local fallback per family; it costs no request.
            .filter((f) => !f.startsWith("__nextjs") && !f.endsWith("Fallback")),
        );
        assert.ok(families.length <= 2, `loaded ${families.length} families: ${families.join(", ")}`);
      },
    });
  });

  test("are preloaded, so the first paint has them", { skip }, async () => {
    await visit("/", {
      body: async ({ page }) => {
        const preloads = await page.locator('link[rel="preload"][as="font"]').count();
        assert.ok(preloads > 0, "no font is preloaded");
      },
    });
  });
});

describe("images do not shift the page as they arrive", () => {
  for (const [name, path] of PUBLIC_PAGES.filter(([, p]) => MAIN_PAGES.includes(p))) {
    test(name, { skip }, async () => {
      await visit(path, {
        body: async ({ page }) => {
          const unsized = await page.locator("img").evaluateAll((els) =>
            els
              .filter((el) => {
                if (el.getAttribute("width") && el.getAttribute("height")) return false;
                const style = getComputedStyle(el);
                // A CSS aspect-ratio or a fixed height reserves the space just as well.
                return style.aspectRatio === "auto" && style.height === "auto";
              })
              .map((el) => el.currentSrc.slice(-60) || el.src.slice(-60)),
          );
          assert.deepEqual(unsized, [], `${path} has images with no reserved space`);
        },
      });
    });
  }

  test("the measured layout shift stays inside the Core Web Vitals budget", { skip }, async () => {
    await visit("/", {
      body: async ({ page }) => {
        const shift = await page.evaluate(
          () =>
            new Promise((resolve) => {
              let total = 0;
              new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) if (!entry.hadRecentInput) total += entry.value;
              }).observe({ type: "layout-shift", buffered: true });
              setTimeout(() => resolve(total), 1200);
            }),
        );
        assert.ok(shift < 0.1, `cumulative layout shift is ${shift.toFixed(3)}, the "good" bar is 0.1`);
      },
    });
  });
});

describe("images are loaded when they are needed", () => {
  test("the hero is not deferred", { skip }, async () => {
    await visit("/", {
      body: async ({ page }) => {
        const hero = page.locator(".hero img").first();
        if ((await hero.count()) === 0) return;
        assert.notEqual(await hero.getAttribute("loading"), "lazy", "the largest image on the page is lazy");
      },
    });
  });

  test("the gallery below the fold is", { skip }, async () => {
    await visit("/gallery", {
      body: async ({ page }) => {
        const eager = await page.locator("img").evaluateAll((els) =>
          els
            .filter((el) => el.getBoundingClientRect().top > window.innerHeight * 1.5)
            .filter((el) => el.loading !== "lazy")
            .map((el) => el.src.slice(-50)),
        );
        assert.deepEqual(eager, [], "an image far below the fold is fetched straight away");
      },
    });
  });

  test("nothing is served at many times the size it is drawn", { skip }, async () => {
    await visit("/gallery", {
      body: async ({ page }) => {
        await page.waitForTimeout(800);
        const oversized = await page.locator("img").evaluateAll((els) =>
          els
            // An SVG has no natural size worth comparing: it is drawn at whatever it is given.
            .filter((el) => !el.currentSrc.endsWith(".svg"))
            .filter((el) => el.naturalWidth > 0 && el.getBoundingClientRect().width > 0)
            .filter((el) => el.naturalWidth > el.getBoundingClientRect().width * window.devicePixelRatio * 2.5)
            .map((el) => `${el.src.slice(-45)} ${el.naturalWidth}px for ${Math.round(el.getBoundingClientRect().width)}px`),
        );
        assert.deepEqual(oversized, []);
      },
    });
  });
});

describe("the page is not bigger than it looks", () => {
  // A DOM this size is already generous for a restaurant page; past it, style recalculation on
  // every scroll-driven reveal starts to show on a phone.
  const BUDGET = { "/": 2200, "/karte": 2600, "/vorbestellen": 1800, "/catering": 1600, "/gallery": 1200 };

  for (const [path, budget] of Object.entries(BUDGET)) {
    test(path, { skip }, async () => {
      await visit(path, {
        body: async ({ page }) => {
          const nodes = await page.evaluate(() => document.querySelectorAll("*").length);
          assert.ok(nodes < budget, `${path} renders ${nodes} elements, budget ${budget}`);
        },
      });
    });
  }
});

describe("the public pages are a static shell", () => {
  for (const path of MAIN_PAGES) {
    test(`${path} answers without a round trip to the database`, { skip }, async () => {
      // Not measurable from the browser, but a page that had to wait for Supabase cannot answer
      // this fast twice in a row. The first request may still be compiling in development.
      await fetch(BASE + path);
      const started = Date.now();
      const response = await fetch(BASE + path);
      const elapsed = Date.now() - started;
      assert.equal(response.status, 200);
      assert.ok(elapsed < 2000, `${path} took ${elapsed}ms to answer a warm request`);
    });
  }
});

describe("no request is made twice", () => {
  for (const path of MAIN_PAGES) {
    test(path, { skip }, async () => {
      await visit(path, {
        body: async ({ page }) => {
          const requests = trackRequests(page);
          await page.reload({ waitUntil: "networkidle" });
          const counts = new Map();
          for (const r of requests) {
            if (r.type === "fetch" || r.type === "xhr") continue; // a poll is allowed to repeat
            counts.set(r.url, (counts.get(r.url) ?? 0) + 1);
          }
          const repeated = [...counts].filter(([, n]) => n > 1).map(([url]) => url.slice(-60));
          assert.deepEqual(repeated, []);
        },
      });
    });
  }
});

describe("nothing is broken on the way in", () => {
  for (const path of MAIN_PAGES) {
    test(path, { skip }, async () => {
      await visit(path, {
        body: async ({ page }) => {
          const requests = trackRequests(page);
          await page.reload({ waitUntil: "networkidle" });
          const failed = requests.filter((r) => r.status >= 400).map((r) => `${r.status} ${r.url.slice(-60)}`);
          assert.deepEqual(failed, []);
        },
      });
    });
  }
});

describe("the staff app stays small enough to work on a phone", () => {
  test("the service worker is registered", { skip: skipUnlessBuilt }, async () => {
    // RegisterServiceWorker is a no-op outside production, so this only means anything against a
    // real build; in development there is nothing to register.
    await visit("/staff", {
      staff: true,
      body: async ({ page }) => {
        await page.waitForTimeout(1500);
        const registered = await page.evaluate(() => navigator.serviceWorker.getRegistrations().then((r) => r.length));
        assert.ok(registered > 0, "no service worker, so the staff app has no offline page");
      },
    });
  });

  test("the worker script is served and scoped to the staff area", { skip }, async () => {
    const response = await fetch(`${BASE}/sw.js`);
    assert.equal(response.status, 200);
    const source = await response.text();
    assert.ok(source.includes("/staff"), "the worker does not mention the scope it claims");
  });

  test("the offline page is a real page, not a stub", { skip: skipStaff }, async () => {
    const response = await fetch(`${BASE}/staff/offline`);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.ok(html.length > 500, "the offline page is empty");
  });
});

describe("weight budgets", () => {
  // Only against a production build; see the file header.
  const BUDGET_KB = { "/": 420, "/karte": 420, "/vorbestellen": 400, "/catering": 400, "/gallery": 600 };

  for (const [path, budget] of Object.entries(BUDGET_KB)) {
    test(`${path} under ${budget} KB`, { skip: skipUnlessBuilt }, async () => {
      await visit(path, {
        body: async ({ page }) => {
          let bytes = 0;
          page.on("response", async (response) => {
            const length = Number(response.headers()["content-length"] ?? 0);
            bytes += length;
          });
          await page.reload({ waitUntil: "networkidle" });
          const kb = Math.round(bytes / 1024);
          assert.ok(kb < budget, `${path} transferred ${kb} KB, budget ${budget} KB`);
        },
      });
    });
  }

  test("the JavaScript the browser has to parse stays modest", { skip: skipUnlessBuilt }, async () => {
    await visit("/", {
      body: async ({ page }) => {
        const scripts = await page.evaluate(() =>
          [...document.querySelectorAll("script[src]")].map((s) => s.src),
        );
        const sizes = await Promise.all(
          scripts.map(async (src) => Number((await fetch(src)).headers.get("content-length") ?? 0)),
        );
        const kb = Math.round(sizes.reduce((a, b) => a + b, 0) / 1024);
        assert.ok(kb < 300, `the home page ships ${kb} KB of JavaScript`);
      },
    });
  });
});
