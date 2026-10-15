/**
 * What a guest can actually do.
 *
 * Nothing here submits a form. `request_reservation` has a site-wide quota (15 an hour, 80 a day)
 * and a confirmed booking holds a seat, so a test that books a table takes one away from somebody
 * real. The wizard is walked up to the point of sending and left there.
 */
import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { BASE, closeBrowser, serverIsUp, visit, visitOnPhone } from "./harness.mjs";

const up = await serverIsUp();
const skip = up ? false : `no site at ${BASE}, run npm run dev`;
after(closeBrowser);

/** Today in the shop's timezone, which is what the calendar must agree with. */
const berlinToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date());

describe("the reservation calendar", () => {
  test("marks today as Heute, and marks nothing else", { skip }, async () => {
    await visit("/", {
      body: async ({ page }) => {
        const marked = await page.locator(".day", { has: page.locator("small") }).all();
        assert.equal(marked.length, 1, "exactly one day should be labelled");
        const label = await marked[0].textContent();
        const expected = Number(berlinToday().slice(8));
        assert.ok(
          label.startsWith(String(expected)),
          `the calendar calls day ${label.replace(/\\D+$/, "")} "Heute", but today is the ${expected}.`,
        );
      },
    });
  });

  test("offers no day that has already gone", { skip }, async () => {
    await visit("/", {
      body: async ({ page }) => {
        const first = await page.locator(".calendar-month").first().locator(".day").first();
        const month = await page.locator(".calendar-label").first().textContent();
        const day = Number((await first.textContent()).replace(/\D+$/, ""));
        const today = berlinToday();
        // Only meaningful when the first month shown is the current one, which it is unless today
        // is the last day of a month and everything on offer is in the next one.
        const monthIndex = new Date(`${today}T12:00:00Z`).getUTCMonth();
        const shownIsCurrent = new Intl.DateTimeFormat("de-DE", { month: "long", timeZone: "UTC" })
          .format(new Date(Date.UTC(2026, monthIndex, 1)))
          .toLowerCase();
        if (!month.toLowerCase().includes(shownIsCurrent)) return;
        assert.ok(day >= Number(today.slice(8)), `the calendar starts on the ${day}, today is the ${today.slice(8)}`);
      },
    });
  });

  test("follows the browser's clock, not a date baked into the cached page", { skip }, async () => {
    // The reported bug: just after midnight the page was served from a cache built the previous
    // day, so yesterday was both the first bookable day and the one wearing the "Heute" badge.
    // Winding the browser clock on by a day is the cheapest way to prove the badge is computed
    // from the clock rather than from whatever the server sent.
    const tomorrow = new Date(Date.now() + 26 * 3_600_000);
    const expected = Number(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(tomorrow).slice(8));
    await visit("/", {
      body: async ({ page, context }) => {
        await context.clearCookies();
        await page.clock.setFixedTime(tomorrow);
        await page.reload({ waitUntil: "networkidle" });
        await page.waitForTimeout(500);
        const marked = page.locator(".day", { has: page.locator("small") });
        await marked.first().waitFor({ timeout: 15_000 });
        const label = (await marked.first().textContent()).replace(/\D+$/, "");
        assert.equal(Number(label), expected, "the Heute badge ignored the browser's clock");
      },
    });
  });

  test("a rest day cannot be chosen", { skip }, async () => {
    await visit("/", {
      body: async ({ page }) => {
        const disabled = await page.locator(".day:disabled").count();
        assert.ok(disabled > 0, "no day is closed, which would mean the opening hours never arrived");
        const title = await page.locator(".day:disabled").first().getAttribute("title");
        assert.ok(title && title.length > 0, "a closed day should say why");
      },
    });
  });

  test("picking a day moves the wizard on and offers times", { skip }, async () => {
    await visit("/", {
      body: async ({ page }) => {
        const open = page.locator(".day:not(:disabled)").first();
        await open.scrollIntoViewIfNeeded();
        await open.click();
        await page.locator(".slots.times .slot").first().waitFor({ timeout: 20_000 });
        const times = await page.locator(".slots.times .slot").count();
        assert.ok(times > 0, "a bookable day offered no times");
      },
    });
  });
});

describe("the celebration wizard", () => {
  test("every occasion has its own drawing", { skip }, async () => {
    await visit("/catering", {
      body: async ({ page }) => {
        const buttons = page.locator('.slots.occasions .slot');
        const count = await buttons.count();
        assert.equal(count, 6, "six occasions");
        for (let i = 0; i < count; i++) {
          const svgs = await buttons.nth(i).locator("svg").count();
          assert.equal(svgs, 1, `"${(await buttons.nth(i).textContent()).trim()}" has no icon`);
        }
      },
    });
  });

  test("the drawings are decorative, so a screen reader reads only the words", { skip }, async () => {
    await visit("/catering", {
      body: async ({ page }) => {
        const hidden = await page.locator('.slots.occasions .slot svg[aria-hidden="true"]').count();
        assert.equal(hidden, 6);
      },
    });
  });

  test("the occasions stack into one column on a phone", { skip }, async () => {
    // Six answers of very different lengths used to wrap into a ragged block.
    await visitOnPhone("/catering", {
      body: async ({ page }) => {
        const boxes = await page.locator(".slots.occasions .slot").evaluateAll((els) =>
          els.map((el) => Math.round(el.getBoundingClientRect().x)),
        );
        assert.equal(new Set(boxes).size, 1, "the occasions are not in a single column");
      },
    });
  });

  test("choosing one moves on to the date", { skip }, async () => {
    await visit("/catering", {
      body: async ({ page }) => {
        await page.locator(".slots.occasions .slot").first().click();
        await page.locator("#event_date").waitFor({ timeout: 15_000 });
        assert.ok(await page.locator(".chip").first().isVisible(), "the answer should become a chip");
      },
    });
  });
});

describe("language", () => {
  test("German pages are German and unprefixed", { skip }, async () => {
    await visit("/karte", {
      body: async ({ page }) => {
        assert.equal(await page.locator("html").getAttribute("lang"), "de-DE");
      },
    });
  });

  test("Spanish pages are Spanish", { skip }, async () => {
    await visit("/es/karte", {
      body: async ({ page }) => {
        assert.equal(await page.locator("html").getAttribute("lang"), "es-AR");
      },
    });
  });

  test("the switch keeps you on the same page", { skip }, async () => {
    await visit("/karte", {
      body: async ({ page }) => {
        // Below 1321px the nav lives behind the menu button, which is where the switch is too.
        const link = page.locator('a[hreflang="es"]');
        if (!(await link.isVisible())) await page.locator(".menu-toggle").click();
        await link.click();
        await page.waitForURL(/\/es\/karte$/, { timeout: 30_000 });
      },
    });
  });

  test("the switch is reachable at every width", { skip }, async () => {
    for (const width of [320, 390, 768, 1280, 1440]) {
      await visit("/karte", {
        width,
        body: async ({ page }) => {
          const link = page.locator('a[hreflang="es"]');
          if (!(await link.isVisible())) {
            const toggle = page.locator(".menu-toggle");
            assert.ok(await toggle.isVisible(), `at ${width}px the switch is hidden and so is the menu button`);
            await toggle.click();
          }
          await link.waitFor({ state: "visible", timeout: 10_000 });
        },
      });
    }
  });

  test("every link in the phone menu carries a decorative icon", { skip }, async () => {
    await visit("/", {
      width: 390,
      body: async ({ page }) => {
        await page.locator(".menu-toggle").click();
        const links = page.locator("nav#navigation a:not(.nav-cta):not([hreflang])");
        const count = await links.count();
        assert.ok(count >= 6, `expected the six section links, found ${count}`);
        for (let i = 0; i < count; i++) {
          const icon = links.nth(i).locator("svg.nav-icon");
          assert.equal(await icon.count(), 1, `link ${i} has no icon`);
          assert.equal(await icon.getAttribute("aria-hidden"), "true");
          const box = await icon.boundingBox();
          assert.ok(box && box.width >= 16, `link ${i} icon is not painted`);
        }
      },
    });
  });

  test("the desktop bar stays words only", { skip }, async () => {
    await visit("/", {
      width: 1440,
      body: async ({ page }) => {
        const shown = await page.locator("nav#navigation svg.nav-icon").evaluateAll((els) =>
          els.filter((el) => el.getBoundingClientRect().width > 0).length,
        );
        assert.equal(shown, 0);
      },
    });
  });

  test("an anchor link to the Spanish home page has no trailing slash", { skip }, async () => {
    // "/es/#besuch" redirects to "/es" and drops the hash on the way.
    await visit("/es/karte", {
      body: async ({ page }) => {
        const hrefs = await page.locator('a[href*="#"]').evaluateAll((els) => els.map((e) => e.getAttribute("href")));
        assert.deepEqual(
          hrefs.filter((h) => h.startsWith("/es/#")),
          [],
        );
      },
    });
  });

  test("the Spanish menu says when a dish description is still German", { skip }, async () => {
    await visit("/es/karte", {
      body: async ({ page }) => {
        // Not every dish is untranslated, but any that is must be marked so a screen reader
        // switches voice rather than reading German with a Spanish one.
        const unmarked = await page.evaluate(() =>
          [...document.querySelectorAll(".menu-item-body small")]
            .filter((el) => el.getAttribute("lang") === "de" && !el.textContent.trim())
            .map((el) => el.textContent),
        );
        assert.deepEqual(unmarked, []);
      },
    });
  });
});

describe("the legal pages", () => {
  test("remember which language the reader came from", { skip }, async () => {
    await visit("/es", {
      body: async ({ page }) => {
        const href = await page.locator('a[href*="/datenschutz"]').first().getAttribute("href");
        assert.match(href, /\?von=es$/);
      },
    });
  });

  test("send a Spanish reader back to the Spanish site", { skip }, async () => {
    await visit("/datenschutz?von=es", {
      body: async ({ page }) => {
        const back = await page.locator(".legal-back").first().getAttribute("href");
        assert.equal(back, "/es");
      },
    });
  });
});

describe("every page says what it is", () => {
  const pages = [
    ["/", "de-DE"],
    ["/es", "es-AR"],
    ["/karte", "de-DE"],
    ["/es/karte", "es-AR"],
    ["/catering", "de-DE"],
    ["/vorbestellen", "de-DE"],
    ["/gallery", "de-DE"],
  ];

  for (const [path, lang] of pages) {
    test(`${path} has a title, a description and the right lang`, { skip }, async () => {
      await visit(path, {
        body: async ({ page }) => {
          const title = await page.title();
          assert.ok(title.length > 10, `${path} has a thin title: "${title}"`);
          const description = await page.locator('meta[name="description"]').getAttribute("content");
          assert.ok(description && description.length > 40, `${path} has no useful description`);
          assert.equal(await page.locator("html").getAttribute("lang"), lang);
        },
      });
    });
  }
});

describe("the review platforms on the home page", () => {
  test("lists four platforms, each a link to its own profile with its mark loaded", { skip }, async () => {
    await visit("/", {
      body: async ({ page }) => {
        const cards = page.locator(".review-card");
        assert.equal(await cards.count(), 4);
        const hosts = await cards.evaluateAll((els) => els.map((e) => new URL(e.href).hostname));
        assert.deepEqual(hosts, ["maps.google.com", "coolibri.de", "de.restaurantguru.com", "www.werkenntdenbesten.de"]);
        // Lazy images below the fold only load once scrolled to.
        await page.locator("section.reviews").scrollIntoViewIfNeeded();
        await page
          .waitForFunction(() => [...document.querySelectorAll(".review-mark img")].every((i) => i.complete && i.naturalWidth > 0), null, {
            timeout: 10_000,
          })
          .catch(() => {});
        const marks = await page
          .locator(".review-mark img")
          .evaluateAll((els) => els.map((i) => i.complete && i.naturalWidth > 0));
        assert.deepEqual(marks, [true, true, true, true]);
      },
    });
  });

  test("draws stars only for a platform that has a figure", { skip }, async () => {
    await visit("/", {
      body: async ({ page }) => {
        const cards = await page
          .locator(".review-card")
          .evaluateAll((els) => els.map((e) => ({ stars: !!e.querySelector(".stars"), score: !!e.querySelector(".review-score") })));
        for (const c of cards) assert.equal(c.stars, c.score, "stars without a figure, or a figure without stars");
      },
    });
  });
});

describe("the console stays quiet", () => {
  const pages = ["/", "/es", "/karte", "/catering", "/vorbestellen", "/gallery", "/impressum", "/datenschutz"];
  for (const path of pages) {
    test(path, { skip }, async () => {
      await visit(path, {
        body: async ({ page, errors }) => {
          await page.waitForTimeout(400);
          assert.deepEqual(errors, []);
        },
      });
    });
  }
});
