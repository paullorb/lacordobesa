/** Consent-free analytics. The point of most of these is what is *refused*: nothing a visitor controls
 *  may mint a new counter row. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { deviceFromWidth, isEvent, isStaffPath, isValidDetail, normalizePath, OTHER_PATH } from "@/lib/analytics";
import { dailyBars, pageLabel, toBars, vitalLines } from "@/lib/analytics-view";

describe("normalizePath", () => {
  test("keeps known pages, with or without a trailing slash", () => {
    assert.equal(normalizePath("/karte"), "/karte");
    assert.equal(normalizePath("/karte/"), "/karte");
    assert.equal(normalizePath("/"), "/");
    assert.equal(normalizePath("/es/gallery"), "/es/gallery");
    assert.equal(normalizePath("/es"), "/es");
    assert.equal(normalizePath("/en/gallery"), "/en/gallery");
    assert.equal(normalizePath("/en"), "/en");
  });

  test("drops the token from the private pages", () => {
    assert.equal(normalizePath("/reservierung/abc123SECRET"), "/reservierung/*");
    assert.equal(normalizePath("/es/abmelden/xyz"), "/es/abmelden/*");
    assert.equal(normalizePath("/en/reservierung/abc123SECRET"), "/en/reservierung/*");
  });

  test("folds everything else into one row", () => {
    assert.equal(normalizePath("/wp-admin/setup.php"), OTHER_PATH);
    assert.equal(normalizePath("/karte?x=1"), OTHER_PATH);
  });

  test("staff paths are recognised so they can be skipped", () => {
    assert.ok(isStaffPath("/staff"));
    assert.ok(isStaffPath("/staff/zahlen"));
    assert.ok(!isStaffPath("/staffel"));
  });
});

describe("events", () => {
  test("only the closed list is accepted", () => {
    assert.ok(isEvent("pageview"));
    assert.ok(!isEvent("toString"));
    assert.ok(!isEvent("__proto__"));
    assert.ok(!isEvent(42));
  });

  test("detail is checked per event", () => {
    assert.ok(isValidDetail("click", "phone"));
    assert.ok(!isValidDetail("click", "+49 69 123456"));
    assert.ok(isValidDetail("form_success", "reservation"));
    assert.ok(!isValidDetail("form_success", "Max Mustermann"));
    assert.ok(isValidDetail("pageview", ""));
    assert.ok(!isValidDetail("pageview", "x"));
    assert.ok(isValidDetail("vital", "LCP:good"));
    assert.ok(!isValidDetail("vital", "LCP:good:extra"));
    assert.ok(!isValidDetail("vital", "LCP:2500"));
  });

  test("viewport width becomes one of three buckets", () => {
    assert.equal(deviceFromWidth(390), "phone");
    assert.equal(deviceFromWidth(820), "tablet");
    assert.equal(deviceFromWidth(1440), "desktop");
    assert.equal(deviceFromWidth(NaN), "");
    assert.equal(deviceFromWidth(-1), "");
  });
});

describe("staff view", () => {
  test("daily bars include the quiet days", () => {
    const bars = dailyBars([{ bucket: "2026-10-14", total: 5 }], "2026-10-13", "2026-10-15");
    assert.deepEqual(bars, [
      { label: "13.10.", value: 0 },
      { label: "14.10.", value: 5 },
      { label: "15.10.", value: 0 },
    ]);
  });

  test("the tail of a long list is folded into Weitere", () => {
    const rows = ["a", "b", "c", "d"].map((bucket, i) => ({ bucket, total: 10 - i }));
    const bars = toBars(rows, (k) => k, 2);
    assert.deepEqual(bars, [
      { label: "a", value: 10 },
      { label: "b", value: 9 },
      { label: "Weitere", value: 15 },
    ]);
  });

  test("vitals report a share with its sample size, and null without samples", () => {
    const lines = vitalLines(
      [
        { bucket: "LCP:good", total: 3 },
        { bucket: "LCP:poor", total: 1 },
      ],
      ["LCP", "CLS"],
    );
    assert.equal(lines[0].goodPercent, 75);
    assert.equal(lines[0].total, 4);
    assert.equal(lines[1].goodPercent, null);
  });
});

/**
 * The names the numbers page prints for a stored path. The storage format is deliberately coarse
 * (normalizePath collapses a token route to "/reservierung/*"), so these labels are the only place
 * a staff member learns what a bucket means, and an unlabelled path has to come out as the path
 * rather than as "undefined".
 */
describe("pageLabel", () => {
  test("names the German pages", () => {
    assert.equal(pageLabel("/"), "Startseite");
    assert.equal(pageLabel("/karte"), "Karte");
    assert.equal(pageLabel("/gallery"), "Galerie");
    assert.equal(pageLabel("/catering"), "Feiern und Catering");
  });

  test("tags the Spanish and English pages instead of repeating the name", () => {
    assert.equal(pageLabel("/es/karte"), "Karte (ES)");
    assert.equal(pageLabel("/en/karte"), "Karte (EN)");
    assert.equal(pageLabel("/es/gallery"), "Galerie (ES)");
  });

  test("names a prefixed home page as a home page", () => {
    assert.equal(pageLabel("/es"), "Startseite (ES)");
    assert.equal(pageLabel("/en"), "Startseite (EN)");
  });

  test("names the collapsed token buckets, which is where most guests land from a mail", () => {
    assert.equal(pageLabel("/reservierung/*"), "Reservierung verwalten");
    assert.equal(pageLabel("/vorbestellung/*"), "Vorbestellung verwalten");
    assert.equal(pageLabel("/abmelden/*"), "Specials abmelden");
    assert.equal(pageLabel("/es/reservierung/*"), "Reservierung verwalten (ES)");
  });

  test("names the catch-all bucket", () => {
    assert.equal(pageLabel(OTHER_PATH), "Sonstige Seiten");
  });

  test("falls back to the path itself, never to undefined", () => {
    assert.equal(pageLabel("/a-page-added-later"), "/a-page-added-later");
    // The fallback keeps the whole path, prefix included, so an unlabelled Spanish page reads
    // "/es/… (ES)". Mildly redundant and still legible, which is what matters for a fallback.
    assert.equal(pageLabel("/es/a-page-added-later"), "/es/a-page-added-later (ES)");
    assert.equal(pageLabel(""), "");
  });

  test("labels every path normalizePath can produce", () => {
    // The two have to stay in step: a bucket the writer can store and the reader cannot name shows
    // up on the staff page as a bare path.
    for (const path of ["/", "/karte", "/gallery", "/vorbestellen", "/catering", "/impressum", "/datenschutz", OTHER_PATH]) {
      const stored = normalizePath(path);
      assert.notEqual(pageLabel(stored), undefined, `${stored} has no label`);
      assert.ok(pageLabel(stored).length > 0, `${stored} has an empty label`);
    }
  });
});
