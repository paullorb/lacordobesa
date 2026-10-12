"use client";

import Link from "next/link";
import { LOCALE_NAME, LOCALES, localeHref, type Locale } from "@/lib/i18n";

/** Offers the current page in the other two languages.
 *
 *  Each language is named in its own language, which is the convention that works for somebody who
 *  cannot read the one currently showing. The links point at the same `path` rather than at the home
 *  page, because sending a reader back to the start to change language is the thing that makes people
 *  give up. Plain links, so they work without JavaScript and are crawlable as hreflang targets. */
export function LanguageSwitch({ locale, path, label }: { locale: Locale; path: string; label: string }) {
  return (
    <div className="lang-switch">
      <span className="sr-only" id="lang-switch-label">
        {label}
      </span>
      <ul aria-labelledby="lang-switch-label">
        {LOCALES.map((candidate) => (
          <li key={candidate}>
            {candidate === locale ? (
              <span aria-current="true">{candidate.toUpperCase()}</span>
            ) : (
              <Link href={localeHref(candidate, path)} hrefLang={candidate} lang={candidate}>
                <span aria-hidden="true">{candidate.toUpperCase()}</span>
                <span className="sr-only">{LOCALE_NAME[candidate]}</span>
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
