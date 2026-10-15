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
