/**
 * The twelve pages whose URL is a credential: /reservierung/[token], /vorbestellung/[token] and
 * /abmelden/[token], in all three languages.
 *
 * These had no coverage at all, and they are not a quiet corner. A guest who books or orders gets
 * exactly one link, in a mail, and it goes to one of these pages; if it is broken, the guest's only
 * route to cancelling is the telephone. #134 broke the production build here, on the footer's
 * language switch reading the URL of a token route, and nothing in the suite noticed.
 *
 * Three properties matter and all three are invisible on the page:
 *
 *  - **The switch keeps the token.** A guest who switches language must stay on their own booking.
 *    Dropping the token sends them to a home page and loses the only link they have.
 *  - **noindex and no-referrer.** The token is the credential. Without `referrer: no-referrer` it
 *    walks out in the `Referer` header of the first outbound click; without noindex a crawler that
 *    ever sees the URL puts somebody's booking in a search index.
 *  - **A wrong token says so.** It must be a readable "this link does not work any more", not a
 *    crash and not a blank page.
 *
 * ## This file writes, and that is deliberate
 *
 * A token page cannot be opened without a row to open. So one reservation, one order and one
 * specials sign-up are created here with the **service key** against the **staging** project, and
 * deleted in `after`. That is the one exception to "nothing in tests/e2e writes": the fixtures live
 * for the length of this file, and `request_reservation`'s site-wide quota gets its allowance back
 * when the rows go. Without credentials for staging the whole file skips.
 */
import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { BASE, closeBrowser, serverIsUp, visit } from "./harness.mjs";
// Shared with the database tests on purpose: one definition of "which project, and with which key",
// including its refusal to point at production.
import { admin, anon, bookableDates, berlinDatePlus, skip as skipDatabase, TEST_NAME, testPhone } from "../integration/harness.mjs";

const up = await serverIsUp();
const skip = !up ? `no site at ${BASE}, run npm run dev` : skipDatabase ? skipDatabase : false;

after(closeBrowser);

/** The three token routes, with the locale prefixes each one has. */
const LOCALES = [
  ["de", "", "de-DE"],
  ["es", "/es", "es-AR"],
  ["en", "/en", "en-GB"],
];

let reservationToken;
let preorderToken;
let unsubscribeToken;
let reservationId;
let preorderId;
let optinId;

/**
 * Built at module scope, with top-level await, rather than in a `before()` hook.
 *
 * Node's test runner evaluates the `skip` option when a test is *registered*, which happens before
 * any hook runs. A `{ skip: !preorderToken && "..." }` filled in by `before()` is therefore always
 * read as "skip", and the pre-order and unsubscribe tests silently passed as skipped.
 */
async function arrangeFixtures() {
  const supabase = admin();

  // A reservation, booked the way the Server Action books one.
  const [date] = await bookableDates(1, { from: 7 });
  const { data: slots } = await anon().rpc("reservation_availability", { p_date: date });
  const slot = (slots ?? []).find((s) => s.seats_left >= 2);
  assert.ok(slot, `no bookable slot on ${date}, so the manage page cannot be opened`);
  const { data: id, error } = await supabase.rpc("request_reservation", {
    p_name: TEST_NAME,
    p_phone: testPhone(),
    p_email: null,
    p_party_size: 2,
    p_date: date,
    p_time: slot.slot,
    p_notes: null,
    p_locale: "de",
  });
  assert.equal(error, null, `could not arrange a reservation: ${error?.message}`);
  reservationId = id;
  reservationToken = (await supabase.from("reservations").select("manage_token").eq("id", id).single()).data.manage_token;

  // An order, for the pre-order equivalent of the same page.
  const { data: items } = await supabase
    .from("menu_items")
    .select("id, preorder_step, menu_categories(slug)")
    .eq("is_preorderable", true)
    .eq("is_available", true);
  const single = (items ?? []).find((i) => i.menu_categories?.slug !== "empanadas" && i.preorder_step === 1);
  const { data: hours } = await supabase.from("opening_hours").select("weekday, opens, is_closed");
  let pickup;
  for (let days = 2; days <= 20; days++) {
    const day = berlinDatePlus(days);
    const row = (hours ?? []).find((h) => h.weekday === new Date(`${day}T12:00:00Z`).getUTCDay());
    if (!row || row.is_closed) continue;
    pickup = { date: day, time: row.opens };
    break;
  }
  if (single && pickup) {
    const { data: token } = await supabase.rpc("request_preorder", {
      p_name: TEST_NAME,
      p_phone: testPhone(),
      p_email: null,
      p_pickup_date: pickup.date,
      p_pickup_time: pickup.time,
      p_lines: [{ item_id: single.id, quantity: 1 }],
      p_notes: null,
      p_locale: "de",
      p_preparation: null,
    });
    preorderToken = token;
    preorderId = (await supabase.from("preorders").select("id").eq("manage_token", token).single()).data?.id;
  }

  // A specials sign-up, for the unsubscribe page.
  const { data: optin } = await supabase
    .from("broadcast_optins")
    .insert({ channel: "whatsapp", consent_text: "ZZ test consent", name: TEST_NAME, phone: testPhone() })
    .select("id, unsubscribe_token")
    .single();
  optinId = optin?.id;
  unsubscribeToken = optin?.unsubscribe_token;
}

if (!skip) await arrangeFixtures();

after(async () => {
  if (skip) return;
  const supabase = admin();
  if (reservationId) await supabase.from("reservations").delete().eq("id", reservationId);
  if (preorderId) await supabase.from("preorders").delete().eq("id", preorderId);
  if (optinId) await supabase.from("broadcast_optins").delete().eq("id", optinId);
  // The sweep, in case a test threw before its own row was recorded.
  for (const table of ["reservations", "preorders", "broadcast_optins"]) {
    await supabase.from(table).delete().eq("name", TEST_NAME);
  }
});

/** Everything worth knowing about a token page, read in one go. */
const inspect = (page) =>
  page.evaluate(() => ({
    lang: document.documentElement.lang,
    h1: [...document.querySelectorAll("h1")].map((h) => h.textContent.trim()),
    robots: document.querySelector('meta[name="robots"]')?.content ?? "",
    referrer: document.querySelector('meta[name="referrer"]')?.content ?? "",
    canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? null,
    alternates: [...document.querySelectorAll('link[rel="alternate"]')].map((l) => l.getAttribute("href")),
    // Every link that goes to one of the other two languages.
    languageLinks: [...document.querySelectorAll("a[href]")]
      .map((a) => a.getAttribute("href"))
      .filter((href) => /^\/(es|en)?\/?$|^\/(es|en)\//.test(href) || href.startsWith("/reservierung") || href.startsWith("/vorbestellung") || href.startsWith("/abmelden")),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    text: document.body.innerText.slice(0, 400),
  }));

describe("the guest's reservation link", () => {
  for (const [locale, prefix, lang] of LOCALES) {
    test(`${locale}: opens, in the guest's own language`, { skip }, async () => {
      await visit(`${prefix}/reservierung/${reservationToken}`, {
        body: async ({ page }) => {
          const seen = await inspect(page);
          assert.equal(seen.lang, lang, `the document is ${seen.lang}, the page is ${locale}`);
          assert.equal(seen.h1.length, 1, `${seen.h1.length} h1 headings`);
          assert.ok(seen.h1[0].length > 0, "the heading is empty");
          assert.equal(seen.overflow, 0, `the page is ${seen.overflow}px wider than the window`);
        },
      });
    });

    test(`${locale}: is noindex and sends no referrer, because the URL is the credential`, { skip }, async () => {
      await visit(`${prefix}/reservierung/${reservationToken}`, {
        body: async ({ page }) => {
          const seen = await inspect(page);
          assert.match(seen.robots, /noindex/, "a booking page is indexable");
          assert.match(seen.robots, /nofollow/);
          assert.equal(seen.referrer, "no-referrer", "the token will leak in the Referer header");
          assert.equal(seen.canonical, null, "a token page declares a canonical URL");
          assert.deepEqual(seen.alternates, [], "a token page declares hreflang alternates");
        },
      });
    });

    test(`${locale}: every language link keeps the token`, { skip }, async () => {
      // #134. A switch that drops the token sends the guest to a home page and loses the only link
      // they have to their booking.
      await visit(`${prefix}/reservierung/${reservationToken}`, {
        body: async ({ page }) => {
          const { languageLinks } = await inspect(page);
          const switches = languageLinks.filter((href) => href.includes("/reservierung"));
          assert.ok(switches.length > 0, "there is no language switch on the page at all");
          for (const href of switches) {
            assert.ok(href.includes(reservationToken), `"${href}" drops the token`);
          }
        },
      });
    });

    test(`${locale}: shows the booking's own details`, { skip }, async () => {
      await visit(`${prefix}/reservierung/${reservationToken}`, {
        body: async ({ page }) => {
          const { text } = await inspect(page);
          // Two people, which is what the fixture booked. The wording differs per language, the
          // number does not.
          assert.match(text, /\b2\b/, "the party size is not on the page");
        },
      });
    });
  }

  test("switching language in the browser really lands on the same booking", { skip }, async () => {
    // The href is one thing; following it is another, since the route has to exist in that locale.
    await visit(`/reservierung/${reservationToken}`, {
      body: async ({ page }) => {
        // The header's switch is a hover dropdown and is hidden until pointed at (a7c9228); the
        // footer carries the same links and is the one a tap can reach.
        const link = page.locator(`footer a[href="/es/reservierung/${reservationToken}"]`).first();
        await link.waitFor({ timeout: 10_000 });
        await link.click();
        await page.waitForURL(`**/es/reservierung/${reservationToken}`, { timeout: 30_000 });
        assert.equal(await page.locator("html").getAttribute("lang"), "es-AR");
        assert.equal(await page.locator("h1").count(), 1, "the Spanish page has no single heading");
      },
    });
  });
});

describe("the guest's pre-order link", () => {
  for (const [locale, prefix, lang] of LOCALES) {
    test(`${locale}: opens, is noindex, and keeps the token in every language link`, { skip: skip || (!preorderToken ? "no preorderable dish to arrange an order with" : false) }, async () => {
      await visit(`${prefix}/vorbestellung/${preorderToken}`, {
        body: async ({ page }) => {
          const seen = await inspect(page);
          assert.equal(seen.lang, lang);
          assert.equal(seen.h1.length, 1, `${seen.h1.length} h1 headings`);
          assert.match(seen.robots, /noindex/);
          assert.equal(seen.referrer, "no-referrer");
          assert.equal(seen.overflow, 0, `the page is ${seen.overflow}px wider than the window`);
          for (const href of seen.languageLinks.filter((h) => h.includes("/vorbestellung"))) {
            assert.ok(href.includes(preorderToken), `"${href}" drops the token`);
          }
        },
      });
    });
  }
});

describe("the specials unsubscribe link", () => {
  for (const [locale, prefix, lang] of LOCALES) {
    test(`${locale}: opens and is noindex`, { skip: skip || (!unsubscribeToken ? "no sign-up to unsubscribe from" : false) }, async () => {
      await visit(`${prefix}/abmelden/${unsubscribeToken}`, {
        body: async ({ page }) => {
          const seen = await inspect(page);
          assert.equal(seen.lang, lang);
          assert.equal(seen.h1.length, 1, `${seen.h1.length} h1 headings`);
          assert.match(seen.robots, /noindex/);
          assert.equal(seen.referrer, "no-referrer");
          assert.equal(seen.overflow, 0, `the page is ${seen.overflow}px wider than the window`);
        },
      });
    });
  }
});

describe("a link that does not work any more", () => {
  const WRONG = "0123456789abcdef0123456789abcdef";

  for (const [route, label] of [
    ["/reservierung", "reservation"],
    ["/vorbestellung", "pre-order"],
    ["/abmelden", "unsubscribe"],
  ]) {
    test(`a wrong ${label} token is answered, not crashed on`, { skip }, async () => {
      // A guest with an old link has to read something they can act on. A 500 or a blank page sends
      // them to the telephone, which is the thing these pages exist to avoid.
      const errors = [];
      await visit(`${route}/${WRONG}`, {
        body: async ({ page }) => {
          page.on("pageerror", (error) => errors.push(String(error)));
          const seen = await inspect(page);
          assert.ok(seen.text.trim().length > 20, `${route} with a wrong token renders almost nothing`);
          assert.match(seen.robots, /noindex/, "an error page for a token route should still be noindex");
          assert.deepEqual(errors, [], `${route} threw in the browser`);
        },
      });
    });
  }

  test("a wrong token is not treated as a valid booking", { skip }, async () => {
    await visit(`/reservierung/${WRONG}`, {
      body: async ({ page }) => {
        const { text } = await inspect(page);
        assert.ok(!text.includes(TEST_NAME), "a wrong token showed somebody else's booking");
      },
    });
  });
});
