/**
 * The cached getters the public pages are built from, run against the real database.
 *
 * These are the functions the unit suite cannot reach: each one opens an anonymous Supabase client
 * and is wrapped in `use cache`, so there is nothing to assert without a project to talk to. They
 * are called here exactly as a page calls them, through the `@/` alias, with `cacheLife`/`cacheTag`
 * stubbed out by tests/next-cache-stub.mjs.
 *
 * Two kinds of failure are worth catching. One is a query that returns nothing because a column was
 * renamed or a policy changed, which turns a public page blank without any error anywhere. The other
 * is `getMenu` leaking a price the shop has chosen to hide: prices are blanked in the getter rather
 * than in the UI precisely so that no page can leak one, and that is only true as long as the
 * blanking is where it is.
 *
 * Read-only. Nothing in this file writes.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { admin, skip } from "./harness.mjs";
import {
  fmtTime,
  getActiveSpecials,
  getAnnouncement,
  getClosures,
  getGalleryItems,
  getHomePhotos,
  getMenu,
  getOpeningHours,
  getReservationSettings,
  getReviewScores,
  getSpecialIdeas,
  getUpcomingClosures,
} from "@/lib/data";
import { getPickupRange, getPreorderableItems, getPreorderSettings } from "@/lib/preorders";

describe("getMenu", () => {
  test("returns the categories in the order the shop arranged them", { skip }, async () => {
    const menu = await getMenu();
    assert.ok(menu.length > 0, "the menu came back empty, so /karte would be blank");
    const order = menu.map((c) => c.sort_order);
    assert.deepEqual(order, [...order].sort((a, b) => a - b), "the categories are not in sort_order");
  });

  test("puts every dish under its own category", { skip }, async () => {
    const menu = await getMenu();
    for (const category of menu) {
      for (const item of category.items) {
        assert.equal(item.category_id, category.id, `${item.name} is filed under the wrong category`);
      }
    }
  });

  test("has dishes somewhere, and orders them within a category", { skip }, async () => {
    const menu = await getMenu();
    assert.ok(menu.some((c) => c.items.length > 0), "no category has any dishes");
    for (const category of menu) {
      const order = category.items.map((i) => i.sort_order);
      assert.deepEqual(order, [...order].sort((a, b) => a - b), `${category.label} is not in sort_order`);
    }
  });

  test("blanks the price of a category that hides prices, in the getter and not in the UI", { skip }, async () => {
    // So that no page, present or future, can leak one.
    const menu = await getMenu();
    for (const category of menu) {
      if (category.show_prices === false) {
        for (const item of category.items) {
          assert.equal(item.price_label, null, `${category.label} hides prices but ${item.name} carries one`);
        }
      }
    }
  });

  test("shows only what the public view shows, never an unpublished dish", { skip }, async () => {
    const menu = await getMenu();
    const shown = menu.flatMap((c) => c.items.map((i) => i.id)).sort();
    const { data: view } = await admin().from("menu_items_public").select("id");
    const allowed = new Set(view.map((i) => i.id));
    for (const id of shown) assert.ok(allowed.has(id), `${id} is on the public menu but not in menu_items_public`);
  });
});

describe("getActiveSpecials and getSpecialIdeas", () => {
  test("return lists rather than throwing when there is nothing to show", { skip }, async () => {
    assert.ok(Array.isArray(await getActiveSpecials()));
    assert.ok(Array.isArray(await getSpecialIdeas()));
  });

  test("a special that is still running has not already ended", { skip }, async () => {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date());
    for (const special of await getActiveSpecials()) {
      if (special.ends_on) assert.ok(special.ends_on >= today, `${special.title} ended on ${special.ends_on} and is still shown`);
    }
  });
});

describe("getAnnouncement", () => {
  test("is always a string, so the banner never renders the word undefined", { skip }, async () => {
    // It digs `value.text` out of a jsonb column and falls back to "", which is what the banner
    // tests for. A null or an object reaching the component would draw an empty or broken bar.
    const announcement = await getAnnouncement();
    assert.equal(typeof announcement, "string");
  });

  test("has no leading or trailing whitespace standing in for an empty banner", { skip }, async () => {
    const announcement = await getAnnouncement();
    if (announcement === "") return;
    assert.equal(announcement, announcement.trim(), "the announcement is padded, so the bar shows for nothing");
  });
});

describe("getReviewScores", () => {
  test("comes back in a shape the stars component can read", { skip }, async () => {
    const scores = await getReviewScores();
    if (scores == null) return;
    assert.equal(typeof scores, "object");
  });
});

describe("getOpeningHours", () => {
  test("returns one row per weekday, so no day is missing from the list", { skip }, async () => {
    const hours = await getOpeningHours();
    assert.equal(hours.length, 7, `${hours.length} weekdays, which leaves a gap on the opening hours page`);
    assert.deepEqual([...hours.map((h) => h.weekday)].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6]);
  });

  test("an open day has both an opening and a closing time", { skip }, async () => {
    for (const day of await getOpeningHours()) {
      if (day.is_closed) continue;
      assert.ok(day.opens, `weekday ${day.weekday} is open with no opening time`);
      assert.ok(day.closes, `weekday ${day.weekday} is open with no closing time`);
      assert.ok(fmtTime(day.opens) < fmtTime(day.closes), `weekday ${day.weekday} closes before it opens`);
    }
  });
});

describe("getClosures and getUpcomingClosures", () => {
  test("both return lists", { skip }, async () => {
    assert.ok(Array.isArray(await getClosures()));
    assert.ok(Array.isArray(await getUpcomingClosures()));
  });

  test("the upcoming ones are a subset of all of them, and none has passed", { skip }, async () => {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date());
    const upcoming = await getUpcomingClosures();
    const all = new Set((await getClosures()).map((c) => c.date));
    for (const closure of upcoming) {
      assert.ok(closure.date >= today, `${closure.date} has passed and is still called upcoming`);
      assert.ok(all.has(closure.date), `${closure.date} is upcoming but not among all closures`);
    }
  });
});

describe("getReservationSettings", () => {
  test("fills in every field the booking form reads", { skip }, async () => {
    const settings = await getReservationSettings();
    for (const key of ["enabled", "slot_minutes", "duration_minutes", "capacity_seats", "max_party_size", "min_lead_hours", "max_days_ahead", "last_seating_minutes_before_close"]) {
      assert.ok(key in settings, `${key} is missing, so the form would read undefined`);
    }
  });

  test("agrees with what the database's own function reports", { skip }, async () => {
    // The getter reads site_settings and merges defaults; reservation_settings() does the same in
    // SQL and is what request_reservation validates against. If the two disagree, the form offers
    // something the RPC then refuses.
    const fromGetter = await getReservationSettings();
    const { data: fromDatabase } = await admin().rpc("reservation_settings");
    for (const key of Object.keys(fromDatabase)) {
      assert.equal(String(fromGetter[key]), String(fromDatabase[key]), `${key} differs: form says ${fromGetter[key]}, the RPC says ${fromDatabase[key]}`);
    }
  });
});

describe("getGalleryItems and getHomePhotos", () => {
  test("every gallery picture has something to show", { skip }, async () => {
    for (const item of await getGalleryItems()) {
      assert.ok(item.image_url, `gallery item ${item.id} has no image_url`);
    }
  });

  test("the landing page's photos come back in the documented shape", { skip }, async () => {
    const photos = await getHomePhotos();
    assert.ok("hero" in photos && "featured" in photos);
    assert.ok(Array.isArray(photos.featured));
    if (photos.hero) assert.ok(photos.hero.image_url, "the hero photo has no image");
  });
});

describe("getPreorderSettings and getPickupRange", () => {
  test("the settings fill in every field the order form reads", { skip }, async () => {
    const settings = await getPreorderSettings();
    for (const key of ["enabled", "min_lead_hours", "max_days_ahead", "max_lines", "max_quantity"]) {
      assert.ok(key in settings, `${key} is missing`);
    }
  });

  test("agrees with the database's own preorder_settings()", { skip }, async () => {
    const fromGetter = await getPreorderSettings();
    const { data: fromDatabase } = await admin().rpc("preorder_settings");
    for (const key of Object.keys(fromDatabase)) {
      assert.equal(String(fromGetter[key]), String(fromDatabase[key]), `${key} differs`);
    }
  });

  test("the pickup range starts after the lead time and ends on the horizon", { skip }, async () => {
    const { minDate, maxDate } = await getPickupRange();
    const settings = await getPreorderSettings();
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date());
    assert.match(minDate, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(maxDate, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(minDate >= today, `the earliest pickup day is ${minDate}, which is before today`);
    assert.ok(minDate <= maxDate, `the range is empty: ${minDate} to ${maxDate}`);
    // The horizon counts from today, as request_preorder() does, not from the first pickup day.
    const expectedMax = new Date(`${today}T12:00:00Z`);
    expectedMax.setUTCDate(expectedMax.getUTCDate() + Number(settings.max_days_ahead));
    assert.equal(maxDate, expectedMax.toISOString().slice(0, 10));
  });

  test("the earliest pickup day is one request_preorder would not call too soon", { skip }, async () => {
    // The form must not offer a day the RPC then refuses.
    const { minDate } = await getPickupRange();
    const settings = await getPreorderSettings();
    const earliest = Date.now() + Number(settings.min_lead_hours) * 3600_000;
    const berlinOfEarliest = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date(earliest));
    assert.ok(minDate >= berlinOfEarliest, `the form offers ${minDate} but the lead time reaches ${berlinOfEarliest}`);
  });
});

describe("getPreorderableItems", () => {
  test("offers only dishes the shop takes orders for", { skip }, async () => {
    const items = await getPreorderableItems();
    const { data: orderable } = await admin().from("menu_items").select("id").eq("is_preorderable", true).eq("is_available", true);
    const allowed = new Set(orderable.map((i) => i.id));
    for (const item of items) {
      assert.ok(allowed.has(item.id), `${item.name} is offered but the shop does not take orders for it`);
    }
  });

  test("tells the form the pack size, so it cannot offer seven empanadas", { skip }, async () => {
    for (const item of await getPreorderableItems()) {
      assert.ok(Number.isInteger(item.preorder_step) && item.preorder_step >= 1, `${item.name} has a pack size of ${item.preorder_step}`);
    }
  });

  test("names each dish's category and the slug its drawing is keyed on", { skip }, async () => {
    for (const item of await getPreorderableItems()) {
      assert.ok(item.category, `${item.name} has no category label`);
      assert.ok(item.categorySlug, `${item.name} has no category slug, so it would draw no icon`);
    }
  });

  test("agrees with request_preorder about the pack size", { skip }, async () => {
    // The form multiplies by preorder_step; the RPC takes the modulus of it. A disagreement means
    // the form offers a quantity the RPC refuses as invalid_quantity.
    const items = await getPreorderableItems();
    const { data: rows } = await admin().from("menu_items").select("id, preorder_step");
    const inDatabase = Object.fromEntries(rows.map((r) => [r.id, r.preorder_step]));
    for (const item of items) {
      assert.equal(item.preorder_step, inDatabase[item.id], `${item.name}: form says ${item.preorder_step}, database says ${inDatabase[item.id]}`);
    }
  });
});
