"use client";

import Link from "next/link";
import { useEffect } from "react";
import { SiteHeader } from "@/components/site-header";
import { CONTACT, whatsappHref } from "@/lib/contact";
import { getDictionary } from "@/lib/dictionaries";
import { localeHref, type Locale } from "@/lib/i18n";

/**
 * What a visitor sees when a page throws.
 *
 * In the reader's own language, with the real header and footer, because the alternative is Next's
 * unstyled default and a guest who assumes the restaurant is shut. `retry()` fetches the segment from
 * the server again before re-rendering it, which is what a failed database read needs (`reset()` would
 * only re-render the payload that already failed); the phone number is there for when it is not
 * enough, since somebody trying to book should never be blocked by our bug.
 */
export function ErrorView({ locale, error, retry }: { locale: Locale; error: Error & { digest?: string }; retry: () => void }) {
  const t = getDictionary(locale).error;

  useEffect(() => {
    // The digest is what ties this to the server log; the message itself is scrubbed in production.
    console.error("page error", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="site">
      <SiteHeader whatsappHref={whatsappHref()} locale={locale} />
      <main id="main">
        <section className="section">
          <div className="not-found">
            <p className="eyebrow">{t.eyebrow}</p>
            <h1>{t.title}</h1>
            <p className="not-found-text">{t.text}</p>
            <div className="hero-actions not-found-actions">
              <button type="button" className="button" onClick={() => retry()}>
                {t.retry}
              </button>
              <Link className="button secondary" href={localeHref(locale, "/")}>
                {t.home}
              </Link>
              <a className="text-link not-found-reserve" href={`tel:${CONTACT.phoneE164}`}>
                {CONTACT.phoneDisplay}
              </a>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
