import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary } from "@/lib/dictionaries";
import { alternates, isLocale, localeHref, OG_LOCALE, type Locale } from "@/lib/i18n";

/** Metadata for one public page in one locale.
 *
 *  `alternates.languages` is what tells Google that the three URLs are the same page in different
 *  languages, and `canonical` keeps each one pointing at itself. Both matter more than the document's
 *  `lang` attribute for language targeting, which is why the single root layout staying German is
 *  tolerable. */
export function pageMetadata(
  locale: Locale,
  path: string,
  pick: (d: ReturnType<typeof getDictionary>) => { title: string; description: string },
): Metadata {
  const { title, description } = pick(getDictionary(locale));
  return {
    // The root layout's "%s · La Cordobesa" template applies to child segments only, so `/` escapes
    // it while `/es` would otherwise read "La Cordobesa · … · La Cordobesa". Every home-page title
    // already opens with the name, so it opts out explicitly.
    title: path === "/" ? { absolute: title } : title,
    description,
    alternates: { canonical: localeHref(locale, path), languages: alternates(path) },
    openGraph: { title, description, locale: OG_LOCALE[locale], type: "website" },
  };
}

/** Reads and validates the `[locale]` route param. The layout already 404s an unknown value, so by
 *  the time a page renders this is only narrowing the type. */
export async function localeFromParams(params: Promise<{ locale: string }>): Promise<Locale> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return locale;
}

/** Metadata for a `<token>` page. These are never indexed and never send a referrer: the token in
 *  the URL is the credential for one booking, order or subscription. No alternates either, since
 *  there is nothing for a crawler to compare. */
export function tokenPageMetadata(locale: Locale, title: (d: ReturnType<typeof getDictionary>) => string): Metadata {
  return {
    title: title(getDictionary(locale)),
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}
