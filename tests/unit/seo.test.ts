/**
 * What search engines and AI assistants are told about the shop, beyond the page metadata.
 *
 * The rule throughout is that structured data and /llms.txt may only repeat what the site already
 * says: an FAQ answer that disagrees with the page, or opening hours that are not the stored ones,
 * is worse than saying nothing.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { faqEntries, hoursSummary } from "@/lib/faq";
import { llmsTxt } from "@/lib/llms";
import { breadcrumbJsonLd, cateringJsonLd, faqJsonLd, galleryJsonLd, restaurantJsonLd, websiteJsonLd } from "@/lib/structured-data";
import { getDictionary } from "@/lib/dictionaries";
import { LOCALES } from "@/lib/i18n";
import { CONTACT } from "@/lib/contact";
import robots from "@/app/robots";

type Hours = Parameters<typeof hoursSummary>[0];
const row = (weekday: number, opens: string | null, closes: string | null) => ({ weekday, opens, closes, is_closed: !opens });

// Monday closed, Tuesday to Saturday the same, Sunday different.
const HOURS: Hours = [
  row(1, null, null),
  row(2, "12:00:00", "20:00:00"),
  row(3, "12:00:00", "20:00:00"),
  row(4, "12:00:00", "20:00:00"),
  row(5, "12:00:00", "20:00:00"),
  row(6, "12:00:00", "20:00:00"),
  row(0, "11:30:00", "18:00:00"),
];

describe("hoursSummary", () => {
  test("folds neighbouring days with the same hours into one range", () => {
    assert.equal(hoursSummary(HOURS, "de"), "Montag geschlossen; Dienstag bis Samstag 12:00 bis 20:00; Sonntag 11:30 bis 18:00");
  });

  test("reads two neighbouring days as a pair rather than a range", () => {
    const weekend = [row(6, "11:30:00", "22:00:00"), row(0, "11:30:00", "22:00:00")] as Hours;
    assert.match(hoursSummary(weekend, "de"), /Samstag und Sonntag 11:30 bis 22:00$/);
  });

  test("is written in the reader's language", () => {
    assert.match(hoursSummary(HOURS, "es"), /^Lunes cerrado; Martes a Sábado/i);
    assert.match(hoursSummary(HOURS, "en"), /^Monday closed; Tuesday to Saturday/);
  });

  test("is empty when no day has hours, so the answer falls back to a phone call", () => {
    assert.equal(hoursSummary([], "de"), "");
    const faq = faqEntries("de", { hours: [], reservationsEnabled: true, preordersEnabled: true });
    assert.ok(faq.find((e) => e.id === "oeffnungszeiten")!.answer.startsWith(getDictionary("de").faq.hoursNone));
  });
});

describe("faqEntries", () => {
  test("has the same questions in every language", () => {
    const ids = LOCALES.map((l) => faqEntries(l, { hours: HOURS, reservationsEnabled: true, preordersEnabled: true }).map((e) => e.id).join());
    assert.equal(new Set(ids).size, 1);
  });

  test("answers with the stored address and hours", () => {
    const faq = faqEntries("de", { hours: HOURS, reservationsEnabled: true, preordersEnabled: true });
    assert.ok(faq.find((e) => e.id === "wo")!.answer.includes(CONTACT.street));
    assert.ok(faq.find((e) => e.id === "oeffnungszeiten")!.answer.includes("Dienstag bis Samstag 12:00 bis 20:00"));
  });

  test("does not promise online booking or pre-orders while they are switched off", () => {
    const on = faqEntries("de", { hours: HOURS, reservationsEnabled: true, preordersEnabled: true });
    const off = faqEntries("de", { hours: HOURS, reservationsEnabled: false, preordersEnabled: false });
    for (const id of ["reservieren", "vorbestellen"]) {
      assert.match(on.find((e) => e.id === id)!.answer, /online/);
      assert.doesNotMatch(off.find((e) => e.id === id)!.answer, /online/);
      assert.ok(off.find((e) => e.id === id)!.answer.includes(CONTACT.phoneDisplay));
    }
  });

  test("never mentions allergens or additives, which the shop handles in person", () => {
    for (const locale of LOCALES) {
      const text = JSON.stringify(faqEntries(locale, { hours: HOURS, reservationsEnabled: true, preordersEnabled: true }));
      assert.doesNotMatch(text, /allerg|zusatzstoff|additive|alérg/i);
    }
  });
});

describe("structured data", () => {
  test("the FAQ graph repeats the visible questions word for word", () => {
    const faq = faqEntries("en", { hours: HOURS, reservationsEnabled: true, preordersEnabled: true });
    const graph = faqJsonLd(faq, "en");
    assert.equal(graph["@type"], "FAQPage");
    assert.deepEqual(
      graph.mainEntity.map((q) => [q.name, q.acceptedAnswer.text]),
      faq.map((e) => [e.question, e.answer]),
    );
  });

  test("closed dates become 00:00 to 00:00 special hours", () => {
    const graph = restaurantJsonLd(HOURS as Parameters<typeof restaurantJsonLd>[0], "de", true, ["2026-12-24"]);
    assert.deepEqual(graph.specialOpeningHoursSpecification, [
      { "@type": "OpeningHoursSpecification", opens: "00:00", closes: "00:00", validFrom: "2026-12-24", validThrough: "2026-12-24" },
    ]);
    assert.ok(!("specialOpeningHoursSpecification" in restaurantJsonLd(HOURS as Parameters<typeof restaurantJsonLd>[0])));
  });

  test("offers a reserve action only while reservations are on", () => {
    const types = (enabled: boolean) =>
      restaurantJsonLd(HOURS as Parameters<typeof restaurantJsonLd>[0], "de", enabled).potentialAction.map((a) => a["@type"]);
    assert.deepEqual(types(true), ["ReserveAction", "OrderAction"]);
    assert.deepEqual(types(false), ["OrderAction"]);
  });

  test("the website, catering and gallery graphs point at the one restaurant", () => {
    const restaurant = restaurantJsonLd([])["@id"];
    const t = getDictionary("de").cateringPage;
    assert.equal(websiteJsonLd("de").publisher["@id"], restaurant);
    assert.equal(cateringJsonLd("de", t).provider["@id"], restaurant);
    assert.equal(cateringJsonLd("de", t).hasOfferCatalog.itemListElement.length, t.ideas.length);
    assert.equal(galleryJsonLd("de", "Galerie", [{ url: "https://x/a.jpg", caption: null }]).about["@id"], restaurant);
  });

  test("breadcrumbs run from the home page of the same language", () => {
    const crumbs = breadcrumbJsonLd("es", "/karte", "Menú").itemListElement;
    assert.equal(crumbs.length, 2);
    assert.match(crumbs[0].item, /\/es$/);
    assert.match(crumbs[1].item, /\/es\/karte$/);
  });
});

describe("robots.txt", () => {
  const rules = robots().rules as { userAgent: string | string[]; allow?: string; disallow?: string[] }[];

  test("names the AI search crawlers and lets them in", () => {
    const named = rules.flatMap((r) => (Array.isArray(r.userAgent) ? r.userAgent : [r.userAgent]));
    for (const bot of ["GPTBot", "OAI-SearchBot", "PerplexityBot", "ClaudeBot", "Google-Extended"]) {
      assert.ok(named.includes(bot), `${bot} is not named`);
    }
  });

  test("gives every group the same disallow list, so naming a bot cannot open the token pages", () => {
    const lists = rules.map((r) => JSON.stringify(r.disallow));
    assert.equal(new Set(lists).size, 1);
    assert.ok(rules[0].disallow!.includes("/reservierung/"));
  });
});

describe("llms.txt", () => {
  const menu = [
    {
      id: "c1",
      slug: "empanadas",
      label: "Empanadas",
      note: null,
      items: [{ id: "i1", name: "Criolla", description: "Rindfleisch", description_en: "Beef", description_es: null, subtitle: null, price_label: "4,50 €" }],
    },
  ] as unknown as Parameters<typeof llmsTxt>[0]["menu"];
  const text = llmsTxt({ hours: HOURS as Parameters<typeof llmsTxt>[0]["hours"], menu, closures: [], reservationsEnabled: true, preordersEnabled: true });

  test("opens with the H1 and summary the llms.txt format asks for", () => {
    assert.match(text, /^# La Cordobesa\n\n> /);
  });

  test("carries the address, the hours and the menu with prices", () => {
    assert.ok(text.includes(CONTACT.street));
    assert.ok(text.includes("Tuesday to Saturday 12:00 to 20:00"));
    assert.ok(text.includes("- Criolla (4,50 €): Beef"));
  });

  test("links every page in every language", () => {
    for (const path of ["/karte", "/es/karte", "/en/karte", "/catering", "/vorbestellen", "/gallery"]) {
      assert.ok(text.includes(`${path})`), `${path} is not linked`);
    }
  });
});
