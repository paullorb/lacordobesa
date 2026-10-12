import { notFound } from "next/navigation";
import { isLocale, PREFIXED_LOCALES } from "@/lib/i18n";

/** German lives at the site root, so this subtree only ever serves the prefixed locales, and those
 *  two are prerendered.
 *
 *  `[locale]` is just one path segment, so `/anything` also matches it. `dynamicParams` is not
 *  allowed alongside cacheComponents, so the guard below does that job instead: an unknown value
 *  renders a 404 rather than an empty page in a language that does not exist. */
export function generateStaticParams() {
  return PREFIXED_LOCALES.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale) || locale === "de") notFound();
  return children;
}
