"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowIcon } from "@/components/icons";
import { getDictionary } from "@/lib/dictionaries";
import { DEFAULT_LOCALE, isLocale, localeHref, type Locale } from "@/lib/i18n";
import { LEGAL_FROM, legalHref } from "@/lib/legal-links";

/** The language the reader arrived in, or German when the link carried nothing. */
function useArrivedFrom(): Locale {
  const value = useSearchParams().get(LEGAL_FROM);
  return value && isLocale(value) ? value : DEFAULT_LOCALE;
}

/**
 * The way back out of a legal page, in the language the reader came from.
 *
 * A client component because that is the only thing on these otherwise static pages that depends
 * on the URL; the legal text itself prerenders as before. Both links fall back to German, which is
 * both the default locale and where a bare `/impressum` belongs.
 */
export function LegalBackLink() {
  const locale = useArrivedFrom();
  return (
    <Link href={localeHref(locale, "/")} className="text-link legal-back">
      <ArrowIcon direction="left" size={14} /> {getDictionary(locale).footer.back}
    </Link>
  );
}

/**
 * A short note, in the reader's own language, that the legal text below is German only.
 *
 * Impressum and Datenschutz are deliberately not translated (a translation would be a second legal
 * text to keep in step with the first). A reader who arrived from /es or /en would otherwise land on
 * a wall of German with no explanation. Renders nothing for a German reader. The note carries its own
 * `lang`, because the page around it is `de-DE`.
 */
export function LegalLanguageNote() {
  const locale = useArrivedFrom();
  if (locale === DEFAULT_LOCALE) return null;
  return (
    <p className="legal-note form-note-box" lang={locale} role="note">
      {getDictionary(locale).legalNotice}
    </p>
  );
}

/** The brand lockup in the legal header, which is also a way home. */
export function LegalBrandLink({ children }: { children: React.ReactNode }) {
  const locale = useArrivedFrom();
  return (
    <Link className="brand" href={localeHref(locale, "/")} aria-label={getDictionary(locale).footer.backHome}>
      {children}
    </Link>
  );
}

/** Impressum <-> Datenschutz, keeping whichever language the reader arrived in. */
export function LegalFooterLinks() {
  const locale = useArrivedFrom();
  return (
    <>
      <Link href={legalHref("/impressum", locale)}>Impressum</Link>
      <Link href={legalHref("/datenschutz", locale)}>Datenschutz</Link>
    </>
  );
}
