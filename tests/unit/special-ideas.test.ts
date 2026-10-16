/**
 * The specials ideas shown in the staff editor and on the public specials box (migration
 * 20261016050000).
 *
 * The same three-column convention as `menu_items`: German is the base, Spanish and English are
 * optional, and a missing translation falls back to the German text rather than to an empty card.
 * `menu-text.ts` is the tested sibling of this file; this one went in without tests, so the
 * fallback and the `lang="de"` marking were unpinned.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { ideaTitle, ideaDescription, isIdeaUntranslated, type SpecialIdea } from "@/lib/special-ideas";

/** A row with only the columns the three functions read, cast to the full table type. */
const idea = (over: Partial<SpecialIdea> = {}) =>
  ({
    title: "Empanadas de carne",
    title_es: null,
    title_en: null,
    description: "Mit Rindfleisch, Ei und Oliven.",
    description_es: null,
    description_en: null,
    ...over,
  }) as SpecialIdea;

describe("ideaTitle", () => {
  test("reads German on the German page", () => {
    assert.equal(ideaTitle(idea({ title_es: "spanisch", title_en: "english" }), "de"), "Empanadas de carne");
  });

  test("prefers the reader's language when it is there", () => {
    const row = idea({ title_es: "Empanadas criollas", title_en: "Beef empanadas" });
    assert.equal(ideaTitle(row, "es"), "Empanadas criollas");
    assert.equal(ideaTitle(row, "en"), "Beef empanadas");
  });

  test("falls back to German rather than showing nothing", () => {
    assert.equal(ideaTitle(idea(), "es"), "Empanadas de carne");
    assert.equal(ideaTitle(idea(), "en"), "Empanadas de carne");
  });

  test("an empty string is a translation, not a missing one", () => {
    // ?? not ||: staff who deliberately clear a field get the empty field, not the German text.
    assert.equal(ideaTitle(idea({ title_es: "" }), "es"), "");
  });
});

describe("ideaDescription", () => {
  test("follows the same locale order as the title", () => {
    const row = idea({ description_es: "Con carne.", description_en: "With beef." });
    assert.equal(ideaDescription(row, "de"), "Mit Rindfleisch, Ei und Oliven.");
    assert.equal(ideaDescription(row, "es"), "Con carne.");
    assert.equal(ideaDescription(row, "en"), "With beef.");
  });

  test("falls back to German, and stays null when there is no German either", () => {
    assert.equal(ideaDescription(idea(), "en"), "Mit Rindfleisch, Ei und Oliven.");
    assert.equal(ideaDescription(idea({ description: null }), "en"), null);
  });
});

describe("isIdeaUntranslated", () => {
  test("is never true on the German page, which is the base language", () => {
    assert.equal(isIdeaUntranslated(idea(), "de"), false);
  });

  test("is true when the title falls back to German", () => {
    assert.equal(isIdeaUntranslated(idea(), "es"), true);
    assert.equal(isIdeaUntranslated(idea(), "en"), true);
  });

  test("is true when the title is translated but the description still falls back", () => {
    const row = idea({ title_es: "Empanadas criollas", title_en: "Beef empanadas" });
    assert.equal(isIdeaUntranslated(row, "es"), true);
    assert.equal(isIdeaUntranslated(row, "en"), true);
  });

  test("is false once both columns are filled in", () => {
    const row = idea({
      title_es: "Empanadas criollas",
      description_es: "Con carne.",
      title_en: "Beef empanadas",
      description_en: "With beef.",
    });
    assert.equal(isIdeaUntranslated(row, "es"), false);
    assert.equal(isIdeaUntranslated(row, "en"), false);
  });

  test("a translated title is enough when there is no German description to translate", () => {
    const row = idea({ description: null, title_es: "Empanadas criollas", title_en: "Beef empanadas" });
    assert.equal(isIdeaUntranslated(row, "es"), false);
    assert.equal(isIdeaUntranslated(row, "en"), false);
  });
});
