/** Locale routing and the two dictionaries. German is unprefixed, Spanish lives under /es, and a
 *  Spanish page showing German copy is a defect the project has shipped before. */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { alternates, DEFAULT_LOCALE, INTL_LOCALE, isLocale, LOCALE_NAME, LOCALES, localeHref, OG_LOCALE } from "@/lib/i18n";
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
  });

  test("rejects anything arriving from a form field", () => {
    for (const bad of ["", "en", "DE", "de-DE", "es-AR", "../de"]) {
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
});

describe("alternates", () => {
  test("names every locale by its BCP-47 tag", () => {
    assert.deepEqual(alternates("/karte"), { "de-DE": "/karte", "es-AR": "/es/karte" });
  });

  test("covers all locales for any path", () => {
    assert.equal(Object.keys(alternates("/gallery")).length, LOCALES.length);
  });
});

describe("legalHref", () => {
  test("German needs no marker, because German is where the link leads", () => {
    assert.equal(legalHref("/impressum", "de"), "/impressum");
  });

  test("Spanish carries the way back", () => {
    assert.equal(legalHref("/datenschutz", "es"), `/datenschutz?${LEGAL_FROM}=es`);
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

describe("dictionaries", () => {
  const de = getDictionary("de");
  const es = getDictionary("es");

  test("both languages have exactly the same keys", () => {
    const dePaths = paths(de).sort();
    const esPaths = paths(es).sort();
    assert.deepEqual(
      esPaths.filter((p) => !dePaths.includes(p)),
      [],
      "Spanish has keys German does not",
    );
    assert.deepEqual(
      dePaths.filter((p) => !esPaths.includes(p)),
      [],
      "German has keys Spanish does not",
    );
  });

  test("a key is the same kind of thing in both languages", () => {
    const deKinds = kinds(de);
    const esKinds = kinds(es);
    const mismatched = Object.keys(deKinds).filter((k) => deKinds[k] !== esKinds[k]);
    assert.deepEqual(mismatched, []);
  });

  test("nothing is blank", () => {
    const blank = Object.entries(kinds(es))
      .filter(([, kind]) => kind === "string")
      .map(([path]) => path)
      .filter((path) => {
        const value = path.split(".").reduce<unknown>((acc, k) => (acc as Record<string, unknown>)?.[k], es);
        return typeof value === "string" && value.trim() === "";
      });
    assert.deepEqual(blank, []);
  });

  test("the Spanish copy is not simply the German copy", () => {
    // Not every string differs (brand names, "WhatsApp", a phone number), but most must.
    const deStrings = Object.entries(kinds(de)).filter(([, k]) => k === "string");
    const read = (dict: unknown, path: string) =>
      path.split(".").reduce<unknown>((acc, k) => (acc as Record<string, unknown>)?.[k], dict);
    const identical = deStrings.filter(([path]) => read(de, path) === read(es, path)).length;
    assert.ok(identical / deStrings.length < 0.35, `${identical}/${deStrings.length} strings are untranslated`);
  });
});

describe("German copy has no dashes", () => {
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

  test("no em or en dash in either dictionary", () => {
    walk(getDictionary("de"), "de");
    walk(getDictionary("es"), "es");
    assert.deepEqual(offenders, []);
  });
});
