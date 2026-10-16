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
  test("rings today and prints no word on any day", { skip }, async () => {
    await visit("/", {
      body: async ({ page }) => {
        assert.equal(await page.locator(".day small").count(), 0, "no day should carry a label by default");
        const marked = await page.locator(".day.is-today").all();
        assert.equal(marked.length, 1, "exactly one day should be ringed");
        const label = await marked[0].textContent();
        const expected = Number(berlinToday().slice(8));
        assert.equal(Number(label), expected, `the calendar rings day ${label}, but today is the ${expected}.`);
        assert.equal(await marked[0].getAttribute("data-hint"), "Heute");
      },
    });
  });

  test("pointing at a day names it the way people say it", { skip }, async () => {
    await visit("/", {
      body: async ({ page }) => {
        const hints = await page.locator(".day:not(:disabled)").evaluateAll((els) => els.slice(0, 3).map((e) => e.getAttribute("data-hint")));
        assert.ok(hints.every((h) => h && h.length > 0), "every open day should have a hint");
        assert.ok(hints.includes("Heute") || hints.includes("Morgen") || hints.includes("Übermorgen"), `no relative name among ${hints}`);
        const day = page.locator(".day:not(:disabled)").first();
        await day.scrollIntoViewIfNeeded();
        await day.hover();
        await page.waitForTimeout(300);
        const content = await day.evaluate((e) => getComputedStyle(e, "::after").content);
        assert.notEqual(content, "none", "the hint is not drawn on hover");
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
      // Before the first load, not as a reload afterwards: the clock has to be wound on before any
      // script reads it, and a second navigation finds everything cached and never goes idle.
      before: async ({ page, context }) => {
        await context.clearCookies();
        await page.clock.setFixedTime(tomorrow);
      },
      body: async ({ page }) => {
        await page.waitForTimeout(500);
        const marked = page.locator(".day.is-today");
        await marked.first().waitFor({ timeout: 15_000 });
        const label = (await marked.first().textContent()).replace(/\D+$/, "");
        assert.equal(Number(label), expected, "the today ring ignored the browser's clock");
      },
    });
  });

  test("a rest day cannot be chosen", { skip }, async () => {
    await visit("/", {
      body: async ({ page }) => {
        const disabled = await page.locator(".day:disabled").count();
        assert.ok(disabled > 0, "no day is closed, which would mean the opening hours never arrived");
        const hint = await page.locator(".day:disabled").first().getAttribute("data-hint");
        assert.ok(hint && hint.length > 0, "a closed day should say why");
      },
    });
  });

  test("picking a day moves the wizard on and offers times", { skip }, async () => {
    await visit("/", {
      body: async ({ page }) => {
        // Deliberately not the *first* open day, which is today. Today runs out of bookable slots
        // during the evening: the lead time is two hours and the last seating is an hour before
        // close, so from about 19:30 Frankfurt time today offers nothing, correctly. Asserting that
        // today offers times therefore fails on any run late in the day, which is what happened on
        // main at 19:00. The next open day has a full day of slots whatever the hour.
        const open = page.locator(".day:not(:disabled):not(.is-today)").first();
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
        const dates = page.locator(".slots:not(.occasions) .slot");
        await dates.first().waitFor({ timeout: 15_000 });
        assert.ok(await page.locator(".chip").first().isVisible(), "the answer should become a chip");
        // The last two chips are "other date" and "not sure yet"; "other date" opens the picker.
        await dates.nth((await dates.count()) - 2).click();
        await page.locator(".date-input").waitFor({ timeout: 5_000 });
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

  test("English pages are English", { skip }, async () => {
    await visit("/en/karte", {
      body: async ({ page }) => {
        assert.equal(await page.locator("html").getAttribute("lang"), "en-GB");
        assert.equal(await page.locator("h1").count(), 1);
      },
    });
  });

  test("/en is a page of its own, not a redirect to German", { skip }, async () => {
    const response = await fetch(`${BASE}/en`, { redirect: "manual" });
    assert.equal(response.status, 200);
  });

  test("every page names all three languages as alternates, and itself as canonical", { skip }, async () => {
    for (const [path, self] of [
      ["/", "/"],
      ["/es/karte", "/es/karte"],
      ["/en/karte", "/en/karte"],
    ]) {
      await visit(path, {
        body: async ({ page }) => {
          const alternates = await page
            .locator('link[rel="alternate"][hreflang]')
            .evaluateAll((els) => Object.fromEntries(els.map((e) => [e.getAttribute("hreflang"), new URL(e.href).pathname])));
          const karte = path.endsWith("karte");
          assert.equal(alternates["de-DE"], karte ? "/karte" : "/");
          assert.equal(alternates["es-AR"], karte ? "/es/karte" : "/es");
          assert.equal(alternates["en-GB"], karte ? "/en/karte" : "/en");
          const canonical = new URL(await page.locator('link[rel="canonical"]').getAttribute("href")).pathname;
          assert.equal(canonical, self);
          const og = await page.locator('meta[property="og:locale"]').getAttribute("content");
          assert.equal(og, path.startsWith("/en") ? "en_GB" : path.startsWith("/es") ? "es_AR" : "de_DE");
        },
      });
    }
  });

  test("the sitemap lists the English pages", { skip }, async () => {
    const xml = await (await fetch(`${BASE}/sitemap.xml`)).text();
    for (const path of ["/en", "/en/karte", "/en/catering", "/en/vorbestellen", "/en/gallery"]) {
      assert.ok(xml.includes(`${path}</loc>`), `${path} is missing from the sitemap`);
    }
    assert.ok(!xml.includes("/en/reservierung"), "a guest link is in the sitemap");
  });

  for (const [from, to, tail] of [
    ["/karte", "es", "/es/karte"],
    ["/karte", "en", "/en/karte"],
    ["/es/karte", "en", "/en/karte"],
    ["/en/karte", "de", "/karte"],
  ]) {
    test(`the switch keeps you on the same page, ${from} to ${to}`, { skip }, async () => {
      await visit(from, {
        body: async ({ page }) => {
          // The footer carries the switch at every width; the bar's dropdown is tested below.
          await page.locator(`footer .lang-switch a[hreflang="${to}"]`).click();
          await page.waitForURL((url) => url.pathname === tail, { timeout: 30_000 });
        },
      });
    });
  }

  test("the switch is reachable at every width", { skip }, async () => {
    for (const width of [320, 390, 768, 1280, 1440]) {
      await visit("/karte", {
        width,
        body: async ({ page }) => {
          await page.locator('footer .lang-switch a[hreflang="en"]').waitFor({ state: "visible", timeout: 10_000 });
        },
      });
    }
  });

  test("the bar's language dropdown opens on hover and lists all three", { skip }, async () => {
    await visit("/karte", {
      width: 1440,
      body: async ({ page }) => {
        const list = page.locator(".lang-menu-list");
        assert.equal(await list.isVisible(), false, "the list should stay closed until the bar is pointed at");
        await page.locator(".lang-menu").hover();
        await list.waitFor({ state: "visible", timeout: 5_000 });
        assert.equal(await list.locator("a, [aria-current]").count(), 3);
      },
    });
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

  test("stay German for an English reader, with a short English note on top", { skip }, async () => {
    for (const path of ["/impressum", "/datenschutz"]) {
      await visit(`${path}?von=en`, {
        body: async ({ page }) => {
          assert.equal(await page.locator("html").getAttribute("lang"), "de-DE");
          const note = page.locator(".legal-note");
          await note.waitFor({ timeout: 15_000 });
          assert.equal(await note.getAttribute("lang"), "en");
          assert.match(await note.textContent(), /only available in German/);
          assert.equal(await page.locator(".legal-back").first().getAttribute("href"), "/en");
        },
      });
    }
  });

  test("a German reader gets no note", { skip }, async () => {
    await visit("/impressum", {
      body: async ({ page }) => {
        await page.waitForTimeout(500);
        assert.equal(await page.locator(".legal-note").count(), 0);
      },
    });
  });

  test("the English site links to them with the way back", { skip }, async () => {
    await visit("/en", {
      body: async ({ page }) => {
        const href = await page.locator('a[href*="/datenschutz"]').first().getAttribute("href");
        assert.match(href, /\?von=en$/);
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
    ["/en", "en-GB"],
    ["/en/karte", "en-GB"],
    ["/en/catering", "en-GB"],
    ["/en/vorbestellen", "en-GB"],
    ["/en/gallery", "en-GB"],
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
  const pages = ["/", "/es", "/en", "/en/karte", "/karte", "/catering", "/vorbestellen", "/gallery", "/impressum", "/datenschutz"];
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
