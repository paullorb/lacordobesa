/** Locales, and the URL shape that goes with them.
 *
 *  German is the default and stays **unprefixed**: `/`, `/karte`, `/gallery`. Spanish lives under
 *  `/es/...`.
 *
 *  Deliberately no middleware and no dynamic `[locale]` segment. Middleware would put an edge
 *  function in front of every public request, giving up the README's promise that "the public site
 *  stays fully static". A `[locale]` segment avoided that but still cost something: reading the
 *  locale meant awaiting `params` in the page body, which blocks the prefetchable shell that
 *  `partialPrefetching` exists to provide, so client-side navigation to a Spanish page was
 *  measurably worse than to a German one.
 *
 *  So the locale is a literal instead: `app/(de)/page.tsx` and `app/(es)/es/page.tsx` are two thin
 *  wrappers over one shared view in `src/components/pages/`. Nothing to await, every variant
 *  prerenders, navigation stays instant, an unknown path 404s because no route matches it,
 *  and the German URLs never moved. Adding a language means adding wrappers, which is cheap next to
 *  writing the dictionary. */

export const LOCALES = ["de", "es"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "de";

/** Validates a locale arriving from outside the type system, i.e. a form field. */
export const isLocale = (value: string): value is Locale => (LOCALES as readonly string[]).includes(value);

/** BCP-47 tags for Intl and the `lang` attribute. Spanish is es-AR: this is an Argentine bakery,
 *  and the difference shows up in wording the team would recognise as their own. */
export const INTL_LOCALE: Record<Locale, string> = { de: "de-DE", es: "es-AR" };

/** What the language switcher shows. Each name is in its own language, which is the convention that
 *  works for a visitor who cannot read the current one. */
export const LOCALE_NAME: Record<Locale, string> = { de: "Deutsch", es: "Español" };

/** OpenGraph locale codes. */
export const OG_LOCALE: Record<Locale, string> = { de: "de_DE", es: "es_AR" };

/**
 * A site-root-relative path for a locale.
 *
 *   localeHref("de", "/karte")  -> "/karte"
 *   localeHref("es", "/karte")  -> "/es/karte"
 *   localeHref("es", "/")       -> "/es"
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

/** The same page in every locale, for `alternates.languages` and hreflang. */
export function alternates(path: string): Record<string, string> {
  return Object.fromEntries(LOCALES.map((locale) => [INTL_LOCALE[locale], localeHref(locale, path)]));
}
