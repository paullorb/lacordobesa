/** The review platforms on the home page. The rule these tests hold: a figure is shown only if a
 *  person saved it and it is readable; nothing is ever estimated, and an unknown platform is a plain link. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { BASELINE_SCORES, parseRatingValue, parseReviewScores, resolveReviews, REVIEW_PLATFORMS, starsOutOfFive } from "@/lib/reviews";

describe("the platform list", () => {
  test("has Google, coolibri, Restaurant Guru and Wer kennt den Besten, each with an https profile and a mark", () => {
    assert.deepEqual(
      REVIEW_PLATFORMS.map((p) => p.id),
      ["google", "coolibri", "restaurantguru", "werkenntdenbesten"],
    );
    for (const p of REVIEW_PLATFORMS) {
      assert.match(p.url, /^https:\/\//, p.id);
      assert.match(p.mark, /^\/assets\/platforms\/[a-z]+\.(svg|png)$/, p.id);
    }
  });
});

describe("parseRatingValue", () => {
  test("reads a decimal comma and a decimal point", () => {
    assert.equal(parseRatingValue("8,6"), 8.6);
    assert.equal(parseRatingValue("4.5"), 4.5);
  });
  test("refuses blanks and words", () => {
    assert.equal(parseRatingValue(""), null);
    assert.equal(parseRatingValue("  "), null);
    assert.equal(parseRatingValue("gut"), null);
  });
});

describe("starsOutOfFive", () => {
  test("rescales a ten-point score to five stars", () => {
    assert.equal(starsOutOfFive("8,6", "10"), 4.3);
    assert.equal(starsOutOfFive("4,6", "5"), 4.6);
  });
  test("refuses a score outside its own scale", () => {
    assert.equal(starsOutOfFive("11", "10"), null);
    assert.equal(starsOutOfFive("-1", "5"), null);
    assert.equal(starsOutOfFive("4", "0"), null);
  });
});

describe("resolveReviews", () => {
  test("before anything is saved, only the figure that was read by hand is shown", () => {
    const r = resolveReviews(null);
    assert.equal(r.find((p) => p.id === "coolibri")?.score?.value, BASELINE_SCORES.coolibri?.value);
    for (const id of ["google", "restaurantguru", "werkenntdenbesten"]) {
      assert.equal(r.find((p) => p.id === id)?.score, null, `${id} must have no invented figure`);
    }
  });

  test("once staff save a set, it replaces the baseline entirely", () => {
    const r = resolveReviews({ google: { value: "4,6", scale: "5", count: 120, checked: "2026-10-15" } });
    assert.equal(r.find((p) => p.id === "google")?.stars, 4.6);
    assert.equal(r.find((p) => p.id === "coolibri")?.score, null);
  });

  test("a saved empty set shows every platform as a plain link", () => {
    assert.ok(resolveReviews({}).every((p) => p.score === null && p.stars === null));
  });

  test("keeps display order whatever order the stored object has", () => {
    const r = resolveReviews({ werkenntdenbesten: { value: "5", scale: "5", count: 3, checked: "2026-10-15" } });
    assert.deepEqual(
      r.map((p) => p.id),
      REVIEW_PLATFORMS.map((p) => p.id),
    );
  });
});

describe("parseReviewScores", () => {
  test("drops malformed entries rather than repairing them", () => {
    const out = parseReviewScores({
      google: { value: "banana", scale: "5", count: 1, checked: "2026-10-15" },
      coolibri: { value: "9", scale: "10", count: -4, checked: "last week" },
      nonsense: { value: "5", scale: "5" },
    });
    assert.equal(out.google, undefined);
    assert.deepEqual(out.coolibri, { value: "9", scale: "10", count: null, checked: "" });
    assert.equal(Object.keys(out).length, 1);
  });
  test("survives junk", () => {
    assert.deepEqual(parseReviewScores(null), {});
    assert.deepEqual(parseReviewScores("x"), {});
    assert.deepEqual(parseReviewScores([1, 2]), {});
  });
});
