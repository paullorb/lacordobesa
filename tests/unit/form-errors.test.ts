/**
 * How a Server Action turns an error code into a sentence, in the language the guest filled the
 * form in.
 *
 * The two things worth pinning: a form submitted from /es or /en must not answer in German, and a
 * code nobody wrote copy for must still come out as a readable sentence. The RPCs grow codes over
 * time (migration 20261012215042 added the quota ones), so "falls through to something readable"
 * is the property that keeps a new code from reaching a guest as `slot_full`.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { formLocale, formErrors } from "@/lib/form-errors";
import { getDictionary } from "@/lib/dictionaries";
import { DEFAULT_LOCALE, LOCALES } from "@/lib/i18n";

const form = (locale?: string) => {
  const data = new FormData();
  if (locale !== undefined) data.set("locale", locale);
  return data;
};

describe("formLocale", () => {
  test("reads the hidden field every public form submits", () => {
    for (const locale of LOCALES) assert.equal(formLocale(form(locale)), locale);
  });

  test("falls back to German when the field is missing", () => {
    assert.equal(formLocale(new FormData()), DEFAULT_LOCALE);
  });

  test("falls back to German rather than trusting the field", () => {
    // The field comes from the page, so a hand-posted form can say anything.
    for (const value of ["", "fr", "de-DE", "../es", "EN"]) {
      assert.equal(formLocale(form(value)), DEFAULT_LOCALE, `"${value}" should not be accepted as a locale`);
    }
  });
});

describe("formErrors", () => {
  const reservation = (d: ReturnType<typeof getDictionary>) => d.reservation.errors;

  test("the form's own copy wins", () => {
    const message = formErrors(form("de"), reservation)("reservations_disabled");
    assert.equal(message, getDictionary("de").reservation.errors.reservations_disabled);
  });

  test("the shared copy covers a code the form has no line for", () => {
    const message = formErrors(form("de"), reservation)("slot_full");
    assert.equal(message, getDictionary("de").formErrors.slot_full);
  });

  test("an unknown code still reaches the guest as a sentence, not as the code", () => {
    const message = formErrors(form("de"), reservation)("a_code_from_a_later_migration");
    assert.equal(message, getDictionary("de").formErrors.generic);
    assert.ok(!message.includes("_"), "the raw code leaked into the sentence");
  });

  test("answers in the language the form was shown in", () => {
    for (const locale of LOCALES) {
      const message = formErrors(form(locale), reservation)("slot_full");
      assert.equal(message, getDictionary(locale).formErrors.slot_full);
    }
    // And the three really are different sentences, so a fallback to German would show up here.
    const sentences = new Set(LOCALES.map((l) => formErrors(form(l), reservation)("slot_full")));
    assert.equal(sentences.size, LOCALES.length, "two locales answer with the same sentence");
  });

  test("every code in the shared list resolves in every language", () => {
    for (const locale of LOCALES) {
      const resolve = formErrors(form(locale), reservation);
      for (const code of Object.keys(getDictionary(locale).formErrors)) {
        const message = resolve(code);
        assert.ok(message && message.trim().length > 0, `${locale}/${code} has no sentence`);
      }
    }
  });
});
