/** Locale routing and the dictionaries. German is unprefixed, Spanish lives under /es and English
 *  under /en, and a Spanish or English page showing German copy is a defect the project has shipped
 *  before. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { alternates, DEFAULT_LOCALE, INTL_LOCALE, isLocale, LOCALE_NAME, LOCALES, localeHref, localeOfPath, OG_LOCALE, stripLocale } from "@/lib/i18n";
import { getDictionary } from "@/lib/dictionaries";
import { legalHref, LEGAL_FROM } from "@/lib/legal-links";

describe("localeHref", () => {
  test("German keeps the URLs it already had", () => {
    assert.equal(localeHref("de", "/"), "/");
    assert.equal(localeHref("de", "/karte"), "/karte");
    assert.equal(localeHref("de", "/#besuch"), "/#besuch");
  });

  test("Spanish is prefixed, and the root loses its trailing slash", () => {
    assert.equal(localeHref("es", "/"), "/es");
    assert.equal(localeHref("es", "/karte"), "/es/karte");
  });

  test("English is prefixed the same way", () => {
    assert.equal(localeHref("en", "/"), "/en");
    assert.equal(localeHref("en", "/karte"), "/en/karte");
    assert.equal(localeHref("en", "/#besuch"), "/en#besuch");
  });

  test("an anchor-only path keeps the prefix attached to the root", () => {
    assert.equal(localeHref("es", "/#besuch"), "/es#besuch");
  });

  test("never produces a double slash", () => {
    for (const locale of LOCALES) {
      for (const path of ["/", "/karte", "/gallery", "/#besuch", "/vorbestellen"]) {
        assert.doesNotMatch(localeHref(locale, path), /\/\//, `${locale} ${path}`);
      }
    }
  });
});

describe("isLocale", () => {
  test("accepts exactly the supported locales", () => {
    assert.ok(isLocale("de"));
    assert.ok(isLocale("es"));
    assert.ok(isLocale("en"));
  });

  test("rejects anything arriving from a form field", () => {
    for (const bad of ["", "fr", "EN", "DE", "de-DE", "es-AR", "en-GB", "../de"]) {
      assert.equal(isLocale(bad), false, `${bad} should not be a locale`);
    }
  });
});

describe("locale tables", () => {
  test("every locale has a tag, a name and an OG code", () => {
    for (const locale of LOCALES) {
      assert.match(INTL_LOCALE[locale], /^[a-z]{2}-[A-Z]{2}$/);
      assert.ok(LOCALE_NAME[locale].length > 0);
      assert.match(OG_LOCALE[locale], /^[a-z]{2}_[A-Z]{2}$/);
    }
  });

  test("the default locale is one of them", () => {
    assert.ok(LOCALES.includes(DEFAULT_LOCALE));
  });

  test("Spanish is Argentine, because this is an Argentine bakery", () => {
    assert.equal(INTL_LOCALE.es, "es-AR");
  });

  test("English is British, because it is read in Frankfurt", () => {
    assert.equal(INTL_LOCALE.en, "en-GB");
    assert.equal(OG_LOCALE.en, "en_GB");
  });

  test("the three languages are German, Spanish and English, in that order", () => {
    assert.deepEqual([...LOCALES], ["de", "es", "en"]);
  });
});

describe("alternates", () => {
  test("names every locale by its BCP-47 tag", () => {
    assert.deepEqual(alternates("/karte"), { de: "/karte", es: "/es/karte", en: "/en/karte", "x-default": "/karte" });
  });

  test("covers all locales for any path, plus x-default for everyone else", () => {
    assert.equal(Object.keys(alternates("/gallery")).length, LOCALES.length + 1);
    assert.equal(alternates("/gallery")["x-default"], "/gallery");
  });
});

describe("legalHref", () => {
  test("German needs no marker, because German is where the link leads", () => {
    assert.equal(legalHref("/impressum", "de"), "/impressum");
  });

  test("Spanish carries the way back", () => {
    assert.equal(legalHref("/datenschutz", "es"), `/datenschutz?${LEGAL_FROM}=es`);
  });

  test("English carries the way back too", () => {
    assert.equal(legalHref("/impressum", "en"), `/impressum?${LEGAL_FROM}=en`);
  });
});

// ------------------------------------------------------------------ dictionaries

/** Every leaf path in an object, so two dictionaries can be compared key by key. */
function paths(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object") return [prefix];
  if (Array.isArray(value)) return value.flatMap((v, i) => paths(v, `${prefix}[${i}]`));
  return Object.entries(value).flatMap(([k, v]) => paths(v, prefix ? `${prefix}.${k}` : k));
}

/** The kind of every leaf, so a string in one language and a function in the other is caught. */
function kinds(value: unknown, prefix = "", out: Record<string, string> = {}): Record<string, string> {
  if (value === null || typeof value !== "object") {
    out[prefix] = typeof value;
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => kinds(v, `${prefix}[${i}]`, out));
    return out;
  }
  for (const [k, v] of Object.entries(value)) kinds(v, prefix ? `${prefix}.${k}` : k, out);
  return out;
}

const read = (dict: unknown, path: string) =>
  path.split(".").reduce<unknown>((acc, k) => (acc as Record<string, unknown>)?.[k], dict);

/** The strings that are blank on purpose. English gives a time on the 24-hour clock with nothing after
 *  it, where German says "Uhr" and Spanish "hs"; the components skip the separator. */
const BLANK_ON_PURPOSE: Partial<Record<(typeof LOCALES)[number], string[]>> = {
  en: ["reservation.at", "manage.at", "managePreorder.at"],
};

describe("dictionaries", () => {
  const de = getDictionary("de");
  const others = LOCALES.filter((l) => l !== DEFAULT_LOCALE);

  for (const locale of others) {
    const dict = getDictionary(locale);

    test(`${locale} has exactly the same keys as German`, () => {
      const dePaths = paths(de).sort();
      const localePaths = paths(dict).sort();
      assert.deepEqual(
        localePaths.filter((p) => !dePaths.includes(p)),
        [],
        `${locale} has keys German does not`,
      );
      assert.deepEqual(
        dePaths.filter((p) => !localePaths.includes(p)),
        [],
        `German has keys ${locale} does not`,
      );
    });

    test(`a key is the same kind of thing in German and ${locale}`, () => {
      const deKinds = kinds(de);
      const kindsHere = kinds(dict);
      const mismatched = Object.keys(deKinds).filter((k) => deKinds[k] !== kindsHere[k]);
      assert.deepEqual(mismatched, []);
    });

    test(`${locale}: nothing is blank`, () => {
      const allowed = BLANK_ON_PURPOSE[locale] ?? [];
      const blank = Object.entries(kinds(dict))
        .filter(([, kind]) => kind === "string")
        .map(([path]) => path)
        .filter((path) => {
          const value = read(dict, path);
          return typeof value === "string" && value.trim() === "" && !allowed.includes(path);
        });
      assert.deepEqual(blank, []);
    });

    test(`the ${locale} copy is not simply the German copy`, () => {
      // Not every string differs (brand names, "WhatsApp", a phone number), but most must.
      const deStrings = Object.entries(kinds(de)).filter(([, k]) => k === "string");
      const identical = deStrings.filter(([path]) => read(de, path) === read(dict, path)).length;
      assert.ok(identical / deStrings.length < 0.35, `${identical}/${deStrings.length} strings are untranslated`);
    });

    test(`${locale}: the function-valued copy interpolates its arguments`, () => {
      // A translation that drops a placeholder ("Step of 4") still type-checks, so call the functions.
      const probe = (value: unknown, path: string) => {
        if (typeof value === "function") {
          const out = (value as (...a: unknown[]) => string)("ARG1", "ARG2", "ARG3");
          assert.equal(typeof out, "string", path);
          const numeric = (value as (...a: unknown[]) => string)(7, 9, 11);
          assert.match(numeric, /7|9|11/, `${locale}.${path} ignores its arguments`);
          return;
        }
        if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) probe(v, path ? `${path}.${k}` : k);
      };
      probe(dict, "");
    });
  }

  test("the legal-page note exists in every language", () => {
    for (const locale of LOCALES) assert.ok(getDictionary(locale).legalNotice.length > 0, locale);
  });
});

describe("copy has no dashes", () => {
  // A standing rule for this site: commas, colons or "·" instead of em and en dashes.
  const offenders: string[] = [];
  const walk = (value: unknown, path: string) => {
    if (typeof value === "string") {
      if (/[—–]/.test(value)) offenders.push(`${path}: ${value}`);
      return;
    }
    if (value === null || typeof value !== "object") return;
    for (const [k, v] of Object.entries(value)) walk(v, path ? `${path}.${k}` : k);
  };

  test("no em or en dash in any dictionary", () => {
    for (const locale of LOCALES) walk(getDictionary(locale), locale);
    assert.deepEqual(offenders, []);
  });
});

/**
 * The two inverses of localeHref. The footer language switch and the route transition both read the
 * current pathname and have to answer "which language is this, and what is this page without the
 * language", and getting either wrong is how #134 broke the production build: the switch read the
 * URL on a token route and sent a guest to a page that does not exist in their language.
 */
describe("stripLocale", () => {
  test("takes the prefix off a Spanish or English page", () => {
    assert.equal(stripLocale("/es/karte"), "/karte");
    assert.equal(stripLocale("/en/karte"), "/karte");
    assert.equal(stripLocale("/es/vorbestellen"), "/vorbestellen");
  });

  test("turns a prefixed home page into /", () => {
    assert.equal(stripLocale("/es"), "/");
    assert.equal(stripLocale("/en"), "/");
  });

  test("leaves a German page alone, since German carries no prefix", () => {
    for (const path of ["/", "/karte", "/vorbestellen", "/impressum"]) {
      assert.equal(stripLocale(path), path);
    }
  });

  test("keeps a token route's token, which is the credential", () => {
    assert.equal(stripLocale("/es/reservierung/tok_abc123"), "/reservierung/tok_abc123");
    assert.equal(stripLocale("/en/vorbestellung/tok_abc123"), "/vorbestellung/tok_abc123");
    assert.equal(stripLocale("/abmelden/tok_abc123"), "/abmelden/tok_abc123");
  });

  test("does not strip a path that merely starts with those letters", () => {
    // "/essen" begins with "es" and is not Spanish; the check is on the whole segment.
    for (const path of ["/essen", "/english", "/entremeses", "/especiales"]) {
      assert.equal(stripLocale(path), path, `${path} should not be treated as a locale prefix`);
    }
  });

  test("strips only the first prefix, so a locale further down the path survives", () => {
    assert.equal(stripLocale("/es/en"), "/en");
  });
});

describe("localeOfPath", () => {
  test("reads the language off the prefix", () => {
    assert.equal(localeOfPath("/es"), "es");
    assert.equal(localeOfPath("/es/karte"), "es");
    assert.equal(localeOfPath("/en"), "en");
    assert.equal(localeOfPath("/en/karte"), "en");
  });

  test("an unprefixed path is German, which is the default", () => {
    for (const path of ["/", "/karte", "/impressum", "/staff", "/staff/zahlen"]) {
      assert.equal(localeOfPath(path), DEFAULT_LOCALE, path);
    }
  });

  test("does not read a language out of a word that starts the same way", () => {
    for (const path of ["/essen", "/english", "/especiales"]) {
      assert.equal(localeOfPath(path), DEFAULT_LOCALE, path);
    }
  });

  test("is the inverse of localeHref for every locale and page", () => {
    for (const locale of LOCALES) {
      for (const path of ["/", "/karte", "/vorbestellen", "/catering", "/gallery"]) {
        const href = localeHref(locale, path);
        assert.equal(localeOfPath(href), locale, `${href} should be ${locale}`);
        assert.equal(stripLocale(href), path, `${href} should strip back to ${path}`);
      }
    }
  });
});
