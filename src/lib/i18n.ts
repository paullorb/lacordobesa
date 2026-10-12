/** Locales, and the URL shape that goes with them.
 *
 *  German is the default and stays **unprefixed**: `/`, `/karte`, `/gallery`. Spanish and English
 *  live under `/es/...` and `/en/...`.
 *
 *  Deliberately no middleware. The README's promise that "the public site stays fully static" is
 *  worth keeping, and locale rewriting in `proxy.ts` would put an edge function in front of every
 *  public request. Instead each page has one thin wrapper per URL shape (`app/page.tsx` for German,
 *  `app/[locale]/page.tsx` for the other two) over a single shared implementation, so every variant
 *  prerenders and the German URLs never moved. */

export const LOCALES = ["de", "es", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "de";
/** The locales that carry a URL prefix, i.e. everything except the default. */
export const PREFIXED_LOCALES = LOCALES.filter((l) => l !== DEFAULT_LOCALE);

export const isLocale = (value: string): value is Locale => (LOCALES as readonly string[]).includes(value);

/** BCP-47 tags for Intl and the `lang` attribute. Spanish is es-AR: this is an Argentine bakery,
 *  and the difference shows up in wording the team would recognise as their own. */
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
 *   localeHref("es", "/#besuch") -> "/es#besuch"
 */
export function localeHref(locale: Locale, path: string): string {
  const prefix = locale === DEFAULT_LOCALE ? "" : `/${locale}`;
  if (path === "/") return prefix || "/";
  // An anchor-only path ("/#besuch") must keep the prefix attached to the root, not gain a slash.
  return `${prefix}${path}`;
}

/** The same page in every locale, for `alternates.languages` and hreflang. */
export function alternates(path: string): Record<string, string> {
  return Object.fromEntries(LOCALES.map((locale) => [INTL_LOCALE[locale], localeHref(locale, path)]));
}
