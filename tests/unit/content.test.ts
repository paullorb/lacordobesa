/** Constants that have a counterpart outside the type system: a database check constraint, a
 *  schema.org vocabulary, an upload limit the storage bucket also enforces. Drift between the two
 *  halves is invisible until a guest or a member of staff hits it. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { BUDGET_BANDS, BUDGET_CODES, budgetLabel, isBudgetBand, isOccasion, OCCASION_CODES, OCCASIONS, occasionLabel } from "@/lib/events";
import { menuDescription, isUntranslated } from "@/lib/menu-text";
import { GALLERY_CATEGORIES, GALLERY_MAX_BYTES, GALLERY_MIME_TYPES, isGalleryCategory } from "@/lib/gallery";
import { BROADCAST_CHANNELS, CHANNEL_LABEL, isOpenChannel, OPEN_CHANNELS } from "@/lib/broadcast";
import {
  INQUIRY_STATUS_LABEL,
  PREORDER_STATUS_LABEL,
  RESERVATION_STATUS_LABEL,
  WAITLIST_STATUS_LABEL,
} from "@/lib/statuses";
import { restaurantJsonLd, menuJsonLd } from "@/lib/structured-data";
import { FIELD_LIMITS } from "@/lib/reservation-limits";

describe("occasions", () => {
  test("the codes are the keys, in the order the form offers them", () => {
    assert.deepEqual(OCCASION_CODES, Object.keys(OCCASIONS));
  });

  test("every code is a safe identifier, because the database constrains it", () => {
    for (const code of OCCASION_CODES) assert.match(code, /^[a-z-]+$/, code);
  });

  test("'andere' exists, because the form falls back to it", () => {
    assert.ok(OCCASION_CODES.includes("andere"));
  });

  test("isOccasion guards what comes out of a form", () => {
    assert.ok(isOccasion("hochzeit"));
    for (const bad of ["", "Hochzeit", "wedding", "andere "]) assert.equal(isOccasion(bad), false, bad);
  });

  test("an unknown stored code renders as itself rather than blank", () => {
    assert.equal(occasionLabel("hochzeit"), OCCASIONS.hochzeit);
    assert.equal(occasionLabel("silberhochzeit"), "silberhochzeit");
  });
});

describe("budget bands", () => {
  test("the codes are the keys", () => {
    assert.deepEqual(BUDGET_CODES, Object.keys(BUDGET_BANDS));
  });

  test("'unsicher' comes first and is the fallback", () => {
    assert.equal(BUDGET_CODES[0], "unsicher");
    assert.ok(isBudgetBand("unsicher"));
  });

  test("isBudgetBand guards what comes out of a form", () => {
    assert.ok(isBudgetBand("bis-500"));
    for (const bad of ["", "500", "bis 500"]) assert.equal(isBudgetBand(bad), false, bad);
  });

  test("an unknown stored band renders as itself", () => {
    assert.equal(budgetLabel("ueber-2500"), BUDGET_BANDS["ueber-2500"]);
    assert.equal(budgetLabel("ueber-9000"), "ueber-9000");
  });
});

describe("menuDescription", () => {
  const item = { description: "Gefüllte Teigtasche", description_es: "Empanada rellena" };

  test("German reads German", () => {
    assert.equal(menuDescription(item, "de"), "Gefüllte Teigtasche");
  });

  test("Spanish reads Spanish", () => {
    assert.equal(menuDescription(item, "es"), "Empanada rellena");
  });

  test("an untranslated dish falls back to German rather than to a blank line", () => {
    assert.equal(menuDescription({ description: "Gefüllte Teigtasche", description_es: null }, "es"), "Gefüllte Teigtasche");
  });

  test("a dish with no description at all stays empty", () => {
    assert.equal(menuDescription({ description: null, description_es: null }, "es"), null);
  });
});

describe("isUntranslated", () => {
  test("marks German text sitting under a Spanish heading", () => {
    assert.ok(isUntranslated({ description: "Gefüllte Teigtasche", description_es: null }, "es"));
  });

  test("a translated dish is not marked", () => {
    assert.equal(isUntranslated({ description: "Gefüllte Teigtasche", description_es: "Empanada" }, "es"), false);
  });

  test("an empty string counts as translated, because staff chose to leave it blank", () => {
    assert.equal(isUntranslated({ description: "Gefüllte Teigtasche", description_es: "" }, "es"), false);
  });

  test("the German page never marks anything", () => {
    assert.equal(isUntranslated({ description: "Gefüllte Teigtasche", description_es: null }, "de"), false);
  });

  test("a dish with no description is nothing to translate", () => {
    assert.equal(isUntranslated({ description: null, description_es: null }, "es"), false);
  });
});

describe("gallery", () => {
  test("every category has a code and a German label", () => {
    for (const c of GALLERY_CATEGORIES) {
      assert.match(c.value, /^[a-z]+$/);
      assert.ok(c.label.length > 0);
    }
  });

  test("isGalleryCategory guards the upload form", () => {
    assert.ok(isGalleryCategory("venue"));
    for (const bad of ["", "Venue", "other"]) assert.equal(isGalleryCategory(bad), false, bad);
  });

  test("the size cap is 5 MB and every accepted type is an image", () => {
    assert.equal(GALLERY_MAX_BYTES, 5 * 1024 * 1024);
    for (const mime of GALLERY_MIME_TYPES) assert.match(mime, /^image\//);
  });
});

describe("broadcast channels", () => {
  test("every open channel is a known channel", () => {
    for (const c of OPEN_CHANNELS) assert.ok(BROADCAST_CHANNELS.includes(c), c);
  });

  test("every channel has a label", () => {
    for (const c of BROADCAST_CHANNELS) assert.ok(CHANNEL_LABEL[c].length > 0, c);
  });

  test("e-mail stays shut until it has a confirmation step", () => {
    assert.equal(isOpenChannel("email"), false);
    assert.ok(isOpenChannel("whatsapp"));
  });
});

describe("status labels", () => {
  test("no status renders blank in the staff lists", () => {
    const tables = {
      reservation: RESERVATION_STATUS_LABEL,
      waitlist: WAITLIST_STATUS_LABEL,
      preorder: PREORDER_STATUS_LABEL,
      inquiry: INQUIRY_STATUS_LABEL,
    };
    for (const [name, table] of Object.entries(tables)) {
      const entries = Object.entries(table);
      assert.ok(entries.length > 0, `${name} has no statuses`);
      for (const [key, label] of entries) assert.ok(String(label).trim().length > 0, `${name}.${key} is blank`);
    }
  });
});

describe("FIELD_LIMITS", () => {
  test("match what the columns and the RPCs accept", () => {
    assert.equal(FIELD_LIMITS.email, 254); // the longest address RFC 5321 allows
    for (const [field, limit] of Object.entries(FIELD_LIMITS)) {
      assert.ok(limit > 0 && Number.isInteger(limit), `${field} = ${limit}`);
    }
  });
});

describe("restaurantJsonLd", () => {
  const hours = [
    { weekday: 1, opens: null, closes: null, is_closed: true },
    { weekday: 4, opens: "16:00:00", closes: "22:00:00", is_closed: false },
    { weekday: 0, opens: "11:30:00", closes: "22:00:00", is_closed: false },
  ];
  // The rows carry more columns in the database; only these four are read.
  const jsonLd = restaurantJsonLd(hours as Parameters<typeof restaurantJsonLd>[0]);

  test("is a Restaurant with an @id other graphs can point at", () => {
    assert.equal(jsonLd["@type"], "Restaurant");
    assert.match(String(jsonLd["@id"]), /#restaurant$/);
  });

  test("splits the postcode out of the city line", () => {
    const address = jsonLd.address as Record<string, string>;
    assert.equal(address.postalCode, "60431");
    assert.equal(address.addressLocality, "Frankfurt am Main");
    assert.equal(address.addressCountry, "DE");
  });

  test("leaves a rest day out instead of publishing 00:00 to 00:00", () => {
    const spec = jsonLd.openingHoursSpecification as { dayOfWeek: string; opens: string; closes: string }[];
    assert.equal(spec.length, 2);
    assert.ok(!spec.some((s) => s.dayOfWeek.endsWith("Monday")));
  });

  test("uses schema.org's English day names, with Sunday as weekday 0", () => {
    const spec = jsonLd.openingHoursSpecification as { dayOfWeek: string; opens: string; closes: string }[];
    assert.deepEqual(
      spec.map((s) => s.dayOfWeek),
      ["https://schema.org/Thursday", "https://schema.org/Sunday"],
    );
  });

  test("trims the seconds off the times", () => {
    const spec = jsonLd.openingHoursSpecification as { opens: string; closes: string }[];
    for (const s of spec) {
      assert.match(s.opens, /^\d{2}:\d{2}$/);
      assert.match(s.closes, /^\d{2}:\d{2}$/);
    }
  });

  test("serialises, which is all the page does with it", () => {
    assert.doesNotThrow(() => JSON.stringify(jsonLd));
  });
});

describe("menuJsonLd", () => {
  const menu = [
    {
      id: "c1",
      slug: "empanadas",
      label: "Empanadas",
      items: [
        { id: "i1", name: "Empanada Criolla", description: "Rindfleisch", price_label: "4,50 €", is_available: true },
        { id: "i2", name: "Ausverkauft", description: null, price_label: "4,50 €", is_available: false },
      ],
    },
  ];
  const jsonLd = menuJsonLd(menu as unknown as Parameters<typeof menuJsonLd>[0]);

  test("serialises to something with the dish names in it", () => {
    const json = JSON.stringify(jsonLd);
    assert.ok(json.includes("Empanada Criolla"));
  });
});
