import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { DM_Sans, Playfair_Display } from "next/font/google";
import { getDictionary } from "@/lib/dictionaries";
import { INTL_LOCALE, OG_LOCALE, type Locale } from "@/lib/i18n";
import { SITE_URL } from "@/lib/site";

// Self-hosted at build time, so no request goes to Google Fonts from the visitor's browser.
// Declared once here rather than in each root layout, so both groups load the same two files.
const sans = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-sans" });
const serif = Playfair_Display({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-serif",
});

export const viewport: Viewport = { themeColor: "#f5f1e9" };

/**
 * The document every page is rendered into.
 *
 * There is one of these per language rather than one for the whole site, because `<html lang>` has
 * to be right and a single root layout can only ever hardcode one value. Next allows a root layout
 * per top-level route group, so `(de)` and `(es)` each own a document and `lang` follows the group
 * the URL fell into. The cost is a full page load when crossing between them, which happens exactly
 * once per visit: when somebody switches language.
 */
export function RootDocument({ locale, children }: { locale: Locale; children: ReactNode }) {
  return (
    <html lang={INTL_LOCALE[locale]} className={`${sans.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  );
}

/** The site-wide defaults a page's own metadata is merged into. */
export function rootMetadata(locale: Locale): Metadata {
  const t = getDictionary(locale).home;
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: t.title, template: "%s · La Cordobesa" },
    description: t.description,
    icons: { icon: "/assets/favicon.svg", apple: "/icons/apple-touch-icon.png" },
    openGraph: {
      title: t.title,
      description: t.description,
      images: ["/assets/hero-pasteleria.jpg"],
      locale: OG_LOCALE[locale],
      type: "website",
    },
  };
}
