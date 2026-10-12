import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n";

/** The query key the legal pages read to know which language to send the reader back to. */
export const LEGAL_FROM = "von";

/**
 * A link to a legal page that remembers where the reader came from.
 *
 * `/impressum` and `/datenschutz` are German only and live outside the locale route groups, so the
 * page itself cannot tell whether the reader arrived from `/` or from `/es`. Without this, "zurück
 * zur Startseite" silently moved a Spanish reader to the German site. German adds no parameter,
 * because German is where the link already leads.
 */
export const legalHref = (path: string, locale: Locale) =>
  locale === DEFAULT_LOCALE ? path : `${path}?${LEGAL_FROM}=${locale}`;
