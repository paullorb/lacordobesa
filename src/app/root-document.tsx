import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Analytics } from "@/components/analytics";
import { NativePushTapHandler } from "@/components/native-push-tap";
import { APPS, ICONS } from "@/lib/brand";
import { getDictionary } from "@/lib/dictionaries";
import { INTL_LOCALE, OG_LOCALE, type Locale } from "@/lib/i18n";
import { OG_IMAGE, SITE_URL } from "@/lib/site";

export const viewport: Viewport = { themeColor: APPS.public.themeColor };

/**
 * The document every page is rendered into.
 *
 * There is one of these per language rather than one for the whole site, because `<html lang>` has
 * to be right and a single root layout can only ever hardcode one value. Next allows a root layout
 * per top-level route group, so `(de)` and `(es)` each own a document and `lang` follows the group
 * the URL fell into. The cost is a full page load when crossing between them, which happens exactly
 * once per visit: when somebody switches language.
 *
 * `fontVariables` comes from the caller rather than being declared here: a single `next/font/google`
 * call shared by multiple root layouts (and global-not-found.tsx) made Turbopack dev resolve the
 * same generated font module from more than one entry at once on a cold request, which trips its
 * "next/font/google queries have exactly one entry" assertion (500s the very first `GET /`, every
 * requester races to compile the same shared module). Each caller declaring its own, identically
 * configured font (see lib/font-config.ts) keeps every font module owned by exactly one entry.
 */
export function RootDocument({
  locale,
  fontVariables,
  children,
}: {
  locale: Locale;
  fontVariables: string;
  children: ReactNode;
}) {
  return (
    <html lang={INTL_LOCALE[locale]} data-scroll-behavior="smooth" className={fontVariables}>
      <body>
        {children}
        <Analytics />
        <NativePushTapHandler />
      </body>
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
    // Where every icon comes from, and how to swap the logo: see lib/brand.ts.
    icons: { icon: [...ICONS.favicon], apple: APPS.public.appleIcon },
    // The public site installs as "La Cordobesa". The staff area links its own manifest, scoped to /staff.
    manifest: APPS.public.path,
    appleWebApp: { capable: true, title: APPS.public.shortName, statusBarStyle: "default" },
    openGraph: {
      title: t.title,
      description: t.description,
      images: [OG_IMAGE],
      locale: OG_LOCALE[locale],
      type: "website",
    },
  };
}
