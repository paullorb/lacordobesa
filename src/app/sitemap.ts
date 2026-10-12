import type { MetadataRoute } from "next";
import { CATERING_PATH } from "@/components/pages/catering-view";
import { GALLERY_PATH } from "@/components/pages/gallery-view";
import { HOME_PATH } from "@/components/pages/home-view";
import { MENU_PATH } from "@/components/pages/menu-view";
import { PREORDER_PATH } from "@/components/pages/preorder-view";
import { alternates, LOCALES, localeHref } from "@/lib/i18n";
import { SITE_URL } from "@/lib/site";

/** Every public page, in every language. The legal pages are German only by design, so they appear
 *  once; the token pages are deliberately absent, for the same reason robots.ts disallows them. */
const PAGES: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: HOME_PATH, priority: 1, changeFrequency: "weekly" },
  { path: MENU_PATH, priority: 0.9, changeFrequency: "weekly" },
  { path: PREORDER_PATH, priority: 0.8, changeFrequency: "monthly" },
  { path: CATERING_PATH, priority: 0.8, changeFrequency: "monthly" },
  { path: GALLERY_PATH, priority: 0.6, changeFrequency: "monthly" },
];

const GERMAN_ONLY = ["/impressum", "/datenschutz"];

export default function sitemap(): MetadataRoute.Sitemap {
  const url = (href: string) => `${SITE_URL}${href === "/" ? "" : href}`;

  // One entry per locale per page, each carrying the full set of alternates. That is what tells
  // Google the two URLs are one page in two languages rather than two thin duplicates.
  const localized = PAGES.flatMap(({ path, priority, changeFrequency }) =>
    LOCALES.map((locale) => ({
      url: url(localeHref(locale, path)),
      changeFrequency,
      priority,
      alternates: {
        languages: Object.fromEntries(Object.entries(alternates(path)).map(([tag, href]) => [tag, url(href)])),
      },
    })),
  );

  return [
    ...localized,
    ...GERMAN_ONLY.map((path) => ({ url: url(path), changeFrequency: "yearly" as const, priority: 0.2 })),
  ];
}
