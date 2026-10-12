import type { Metadata } from "next";
import Link from "next/link";
import { RootDocument } from "@/app/root-document";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { whatsappHref } from "@/lib/contact";
import { getDictionary } from "@/lib/dictionaries";
import { DEFAULT_LOCALE, localeHref } from "@/lib/i18n";
import "@/app/globals.css";

export const metadata: Metadata = { title: "404 · La Cordobesa" };

/**
 * The page a URL matching no route at all lands on.
 *
 * `global-not-found` rather than `not-found`, because the site has one root layout per language and
 * so has no single layout a 404 could be composed from. It bypasses layouts entirely, which is why
 * it renders its own document and imports the stylesheet itself.
 *
 * German: a path that matched nothing carries no locale to read. The header's language switch is
 * still there, so a Spanish reader is one click from `/es`.
 */
export default function GlobalNotFound() {
  const t = getDictionary(DEFAULT_LOCALE).notFound;
  const href = (path: string) => localeHref(DEFAULT_LOCALE, path);

  return (
    <RootDocument locale={DEFAULT_LOCALE}>
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
    </RootDocument>
  );
}
