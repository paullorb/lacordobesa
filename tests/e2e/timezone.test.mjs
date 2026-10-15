/**
 * The shop's clock, seen from the other side of the world (issue #104).
 *
 * La Cordobesa is in Frankfurt. "Today", "open now" and the first bookable day all mean Frankfurt,
 * for everybody: a guest planning a visit from Los Angeles or Tokyo is asking about the shop's
 * Thursday, not their own. The code reads the browser's clock (the page around it is a cached
 * shell) and converts it with `timeZone: "Europe/Berlin"`, so the risk is a place that forgot to
 * convert. These tests make the browser's clock and timezone disagree with Frankfurt's on purpose,
 * around Frankfurt's midnight, which is where a missing conversion shows as a day out.
 *
 * Nothing here submits a form.
 */
import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { BASE, closeBrowser, PROJECT, PROJECTS, serverIsUp, visit } from "./harness.mjs";

const up = await serverIsUp();
after(closeBrowser);
const skip = up ? false : `no site at ${BASE}, run npm run dev`;

const berlinDate = (instant) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(instant);

/** The next midnight in Frankfurt, found by stepping a quarter hour at a time (every zone offset
 *  Berlin has ever had is a multiple of that). Relative to now, not a fixed date, so the test keeps
 *  working after the date it was written on and stays inside the window the server has cached. */
function nextBerlinMidnight(from = new Date()) {
  const today = berlinDate(from);
  const step = 15 * 60_000;
  let t = Math.ceil(from.getTime() / step) * step;
  while (berlinDate(new Date(t)) === today) t += step;
  return t;
}

const MIDNIGHT = nextBerlinMidnight();
const MOMENTS = [
  ["half an hour before midnight in Frankfurt", new Date(MIDNIGHT - 30 * 60_000)],
  ["half an hour after midnight in Frankfurt", new Date(MIDNIGHT + 30 * 60_000)],
];

// The machine is somewhere else: a day behind, a day ahead, and at both extremes of the map.
const ZONES = ["Europe/Berlin", "America/Los_Angeles", "Asia/Tokyo", "Pacific/Pago_Pago", "Pacific/Kiritimati"];

/** What a visitor would read off the home page at `at`, in `timezoneId`. */
async function snapshot(timezoneId, at) {
  let seen;
  await visit("/", {
    timezoneId,
    at,
    body: async ({ page }) => {
      await page.waitForFunction(() => document.querySelector(".open-status")?.dataset.state !== "pending", null, {
        timeout: 15_000,
      });
      const marked = page.locator(".day", { has: page.locator("small") });
      await marked.first().waitFor({ timeout: 15_000 });
      seen = {
        // Which day is labelled "Heute", and which day the calendar starts on.
        heute: (await marked.first().getAttribute("aria-label")) ?? "",
        firstBookable: (await page.locator(".day:not(:disabled)").first().getAttribute("aria-label")) ?? "",
        state: await page.locator(".open-status").first().getAttribute("data-state"),
        status: ((await page.locator(".open-status").first().textContent()) ?? "").trim(),
        // The machine really was somewhere else.
        localDate: await page.evaluate(() => new Date().toLocaleDateString("en-CA")),
      };
    },
  });
  return seen;
}

describe(`${PROJECTS[PROJECT].label}: the visitor's timezone does not change the shop's day`, () => {
  for (const [moment, at] of MOMENTS) {
    describe(moment, () => {
      const expected = berlinDate(at);
      const [, , dd] = expected.split("-");
      let baseline;

      test("Frankfurt itself", { skip }, async () => {
        baseline = await snapshot("Europe/Berlin", at);
        assert.match(
          baseline.heute,
          new RegExp(`${dd}\\.${expected.slice(5, 7)}\\.${expected.slice(0, 4)}`),
          `"Heute" is ${baseline.heute}, Frankfurt's date is ${expected}`,
        );
        assert.ok(baseline.firstBookable !== "", "nothing is bookable");
      });

      for (const zone of ZONES.filter((z) => z !== "Europe/Berlin")) {
        test(zone, { skip }, async () => {
          baseline ??= await snapshot("Europe/Berlin", at);
          const seen = await snapshot(zone, at);
          assert.deepEqual(seen.heute, baseline.heute, `"Heute" moved in ${zone}`);
          assert.deepEqual(seen.firstBookable, baseline.firstBookable, `the first bookable day moved in ${zone}`);
          assert.deepEqual(
            { state: seen.state, status: seen.status },
            { state: baseline.state, status: baseline.status },
            `"open now" moved in ${zone}`,
          );
        });
      }
    });
  }

  test("the shop is not 'open now' half an hour after midnight, wherever you are", { skip }, async () => {
    const [, after] = MOMENTS[1];
    for (const zone of ZONES) {
      const seen = await snapshot(zone, after);
      assert.notEqual(seen.state, "open", `${zone}: the line says "${seen.status}" at 00:30 in Frankfurt`);
    }
  });

  test("the browser really is in another timezone", { skip }, async () => {
    // Without this the loop above could pass by every context quietly falling back to the host.
    const [, before] = MOMENTS[0];
    const tokyo = await snapshot("Asia/Tokyo", before);
    const berlin = await snapshot("Europe/Berlin", before);
    assert.notEqual(tokyo.localDate, berlin.localDate, "Tokyo and Frankfurt should disagree about the date");
  });
});

describe(`${PROJECTS[PROJECT].label}: the browser's language is not the site's language`, () => {
  // There is no Accept-Language negotiation on purpose (src/lib/i18n.ts: no middleware, so the public
  // site stays static). German is the default whatever the browser asks for, and Spanish is a link.
  // These pin that, so adding negotiation later is a decision and not an accident.
  for (const locale of ["de-DE", "es-AR", "es-ES", "en-US", "en-GB", "ja-JP"]) {
    test(`a ${locale} browser gets German at /, and its own dates are not used`, { skip }, async () => {
      await visit("/", {
        locale,
        body: async ({ page }) => {
          assert.equal(await page.locator("html").getAttribute("lang"), "de-DE");
          assert.match(await page.locator(".calendar-label").first().textContent(), /(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)/);
        },
      });
    });
  }

  for (const locale of ["de-DE", "en-US", "ja-JP"]) {
    test(`a ${locale} browser gets Spanish at /es, with Spanish month names`, { skip }, async () => {
      await visit("/es", {
        locale,
        body: async ({ page }) => {
          assert.equal(await page.locator("html").getAttribute("lang"), "es-AR");
          assert.match(await page.locator(".calendar-label").first().textContent(), /(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/i);
        },
      });
    });
  }
});
