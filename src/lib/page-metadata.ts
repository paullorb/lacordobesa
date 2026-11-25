import type { Metadata } from "next";
import { getDictionary } from "@/lib/dictionaries";
import { OG_IMAGE, SITE_NAME } from "@/lib/site";
import { alternates, LOCALES, localeHref, OG_LOCALE, type Locale } from "@/lib/i18n";

/** Metadata for one public page in one locale.
 *
 *  `alternates.languages` is what tells Google that the two URLs are the same page in different
 *  languages, and `canonical` keeps each one pointing at itself. Both matter more than the document's
 *  `lang` attribute for language targeting, which is why the single root layout staying German is
 *  tolerable. */
export function pageMetadata(
  locale: Locale,
  path: string,
  pick: (d: ReturnType<typeof getDictionary>) => { title: string; description: string; seoTitle?: string },
): Metadata {
  const picked = pick(getDictionary(locale));
  // `seoTitle` is the search-result wording ("Menü: Empanadas, Alfajores, Pasta & Grill"); `title` is
  // the short on-page heading ("Menü") and only stands in where a page has no separate wording.
  const title = picked.seoTitle ?? picked.title;
  const { description } = picked;
  // A social card is not run through the title template, so it carries the name itself.
  const socialTitle = path === "/" || title.includes(SITE_NAME) ? title : `${title} · ${SITE_NAME}`;
  const canonical = localeHref(locale, path);
  return {
    // The root layout's "%s · La Cordobesa" template applies to child segments only, so `/` escapes
    // it while `/es` would otherwise read "La Cordobesa · … · La Cordobesa". Every home-page title
    // already opens with the name, so it opts out explicitly.
    title: path === "/" ? { absolute: title } : title,
    description,
    alternates: { canonical, languages: alternates(path) },
    // Next replaces, not merges, a page's openGraph over the layout's, so siteName and url are
    // repeated here rather than inherited.
    openGraph: {
      title: socialTitle,
      description,
      url: canonical,
      siteName: SITE_NAME,
      images: [OG_IMAGE],
      locale: OG_LOCALE[locale],
      alternateLocale: LOCALES.filter((l) => l !== locale).map((l) => OG_LOCALE[l]),
      type: "website",
    },
    twitter: { card: "summary_large_image", title: socialTitle, description, images: [OG_IMAGE.url] },
  };
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
