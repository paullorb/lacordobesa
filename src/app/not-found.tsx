import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { whatsappHref } from "@/lib/contact";
import { getDictionary } from "@/lib/dictionaries";
import { DEFAULT_LOCALE, localeHref } from "@/lib/i18n";

// Next already emits `noindex` for a not-found boundary, and links stay followable by default,
// so a second robots meta here would only be a duplicate tag saying the same thing.
export const metadata: Metadata = { title: "404" };

/**
 * The page a wrong URL lands on.
 *
 * German, because this is the root boundary and it catches paths that match no route at all, which
 * carry no locale to read.
 */
export default function NotFound() {
  const t = getDictionary(DEFAULT_LOCALE).notFound;
  const href = (path: string) => localeHref(DEFAULT_LOCALE, path);

  return (
    <div className="site">
      <SiteHeader whatsappHref={whatsappHref()} locale={DEFAULT_LOCALE} />
      <main id="main">
        <section className="section">
          <div className="not-found">
            <p className="eyebrow">{t.eyebrow}</p>
            <p className="not-found-code" aria-hidden="true">
              404
            </p>
            <h1>{t.title}</h1>
            <p className="not-found-text">{t.text}</p>
            <div className="hero-actions not-found-actions">
              <Link className="button" href={href("/")}>
                {t.home}
              </Link>
              <Link className="button secondary" href={href("/karte")}>
                {t.menu}
              </Link>
              <Link className="text-link not-found-reserve" href={href("/#reservieren")}>
                {t.reserve}
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter locale={DEFAULT_LOCALE} />
    </div>
  );
}
