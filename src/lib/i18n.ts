/** Locales, and the URL shape that goes with them.
 *
 *  German is the default and stays **unprefixed**: `/`, `/karte`, `/gallery`. Spanish lives under
 *  `/es/...` and English under `/en/...`.
 *
 *  Deliberately no middleware and no dynamic `[locale]` segment. Middleware would put an edge
 *  function in front of every public request, giving up the README's promise that "the public site
 *  stays fully static". A `[locale]` segment avoided that but still cost something: reading the
 *  locale meant awaiting `params` in the page body, which blocks the prefetchable shell that
 *  `partialPrefetching` exists to provide, so client-side navigation to a Spanish page was
 *  measurably worse than to a German one.
 *
 *  So the locale is a literal instead: `app/(de)/page.tsx`, `app/(es)/es/page.tsx` and `app/(en)/en/page.tsx` are
 *  thin wrappers over one shared view in `src/components/pages/`. Nothing to await, every variant
 *  prerenders, navigation stays instant, an unknown path 404s because no route matches it,
 *  and the German URLs never moved. Adding a language means adding wrappers, which is cheap next to
 *  writing the dictionary.
 *
 *  English was dropped once and brought back on the owner's request (#104). Everything it needs
 *  already existed in the schema (`menu_items.description_en`), except that `reservations.locale`
 *  and `preorders.locale` only accepted de and es: see migration 20261015101518. */

export const LOCALES = ["de", "es", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "de";

/** Validates a locale arriving from outside the type system, i.e. a form field. */
export const isLocale = (value: string): value is Locale => (LOCALES as readonly string[]).includes(value);

/** BCP-47 tags for Intl and the `lang` attribute. Spanish is es-AR: this is an Argentine bakery,
 *  and the difference shows up in wording the team would recognise as their own. English is en-GB:
 *  it is read in Frankfurt, where day-before-month and the 24-hour clock are what people expect. */
export const INTL_LOCALE: Record<Locale, string> = { de: "de-DE", es: "es-AR", en: "en-GB" };

/** What the language switcher shows. Each name is in its own language, which is the convention that
 *  works for a visitor who cannot read the current one. */
export const LOCALE_NAME: Record<Locale, string> = { de: "Deutsch", es: "Español", en: "English" };

/** OpenGraph locale codes. */
export const OG_LOCALE: Record<Locale, string> = { de: "de_DE", es: "es_AR", en: "en_GB" };

/**
 * A site-root-relative path for a locale.
 *
 *   localeHref("de", "/karte")  -> "/karte"
 *   localeHref("es", "/karte")  -> "/es/karte"
 *   localeHref("es", "/")       -> "/es"
 *   localeHref("en", "/karte")  -> "/en/karte"
 *   localeHref("es", "/#besuch") -> "/es#besuch"
 */
export function localeHref(locale: Locale, path: string): string {
  const prefix = locale === DEFAULT_LOCALE ? "" : `/${locale}`;
  if (path === "/") return prefix || "/";
  // An anchor-only path ("/#besuch") must keep the prefix attached to the root, not gain a slash:
  // "/es/#besuch" is a trailing-slash URL that redirects to "/es" and loses the hash on the way.
  // next/link happened to normalise it away, so only a plain <a> or a copied URL ever saw it.
  if (prefix && path.startsWith("/#")) return `${prefix}${path.slice(1)}`;
  return `${prefix}${path}`;
}

/** The same page in every locale, for `alternates.languages` and hreflang.
 *
 *  Keyed by bare language, not by INTL_LOCALE: `hreflang="es-AR"` tells a search engine to serve the
 *  Spanish page to readers in Argentina only, and `en-GB` to the UK only, when the point of both is
 *  readers here who do not read German. The region tags stay on `<html lang>`, where they pick the
 *  wording. `x-default` names the German page for everyone else. */
export function alternates(path: string): Record<string, string> {
  return {
    ...Object.fromEntries(LOCALES.map((locale) => [locale, localeHref(locale, path)])),
    "x-default": localeHref(DEFAULT_LOCALE, path),
  };
}

/** The inverse of localeHref for a pathname: "/es/karte" -> "/karte", "/en" -> "/". */
export function stripLocale(pathname: string): string {
  for (const locale of LOCALES) {
    if (locale === DEFAULT_LOCALE) continue;
    if (pathname === `/${locale}`) return "/";
    if (pathname.startsWith(`/${locale}/`)) return pathname.slice(locale.length + 1);
  }
  return pathname;
}

/** Which language a pathname belongs to: "/es/karte" -> "es", "/karte" -> "de". */
export function localeOfPath(pathname: string): Locale {
  return LOCALES.find((l) => l !== DEFAULT_LOCALE && (pathname === `/${l}` || pathname.startsWith(`/${l}/`))) ?? DEFAULT_LOCALE;
}
