import Link from "next/link";
import { MenuIcon } from "@/components/icons";
import { JsonLd } from "@/components/json-ld";
import { MenuItemIcon } from "@/components/menu-icons";
import { Repulgue } from "@/components/repulgue";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { whatsappHref } from "@/lib/contact";
import { getActiveSpecials, getAnnouncement, getMenu } from "@/lib/data";
import { getDictionary } from "@/lib/dictionaries";
import { localeHref, type Locale } from "@/lib/i18n";
import { isUntranslated, menuDescription } from "@/lib/menu-text";
import { menuJsonLd } from "@/lib/structured-data";

export const MENU_PATH = "/karte";

export async function MenuView({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).menuPage;
  const [announcement, menu, specials] = await Promise.all([getAnnouncement(), getMenu(), getActiveSpecials()]);

  const shown = menu.flatMap((c) => c.items);
  const anyUntranslated = shown.some((i) => isUntranslated(i, locale));
  const categories = menu.filter((c) => c.items.length > 0);

  return (
    <div className="site">
      <JsonLd data={menuJsonLd(menu)} />
      {announcement && <div className="announcement">{announcement}</div>}
      <SiteHeader whatsappHref={whatsappHref()} locale={locale} path={MENU_PATH} />

      <main id="main">
        <section className="menu-page">
          <div className="section-heading">
            <p className="eyebrow">{t.eyebrow}</p>
            <h1>{t.title}</h1>
            <Repulgue className="repulgue-divider" />
            <p>{t.intro}</p>
          </div>

          {specials.length > 0 && (
            <div className="specials">
              {specials.map((s) => (
                <div className="special" key={s.id}>
                  <span className="tag">{getDictionary(locale).home.specialTag}</span>
                  <div>
                    <strong>{s.title}</strong>
                    {s.description && <p>{s.description}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {anyUntranslated && <p className="form-note menu-translation-note">{t.descriptionsInGerman}</p>}

          {/* Sticks under the header while the reader is in the menu, so a long card is one tap
              from any category rather than a scroll back to the top. Plain anchors: no script. */}
          <nav className="menu-index" aria-label={t.indexLabel}>
            <ul>
              {categories.map((c) => (
                <li key={c.id}>
                  <a href={`#${c.slug}`}>{c.label}</a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="menu-cats">
            {categories.map((c, i) => (
              <section className="menu-cat" id={c.slug} key={c.id} aria-labelledby={`${c.slug}-title`}>
                <header className="menu-cat-head">
                  <span className="menu-cat-num" aria-hidden="true">
                    {String(i + 1).padStart(2, "0")} / {String(categories.length).padStart(2, "0")}
                  </span>
                  <MenuIcon slug={c.slug} size={30} className="menu-cat-icon" />
                  <h2 id={`${c.slug}-title`}>{c.label}</h2>
                  {c.label_secondary && <p className="menu-cat-secondary">{c.label_secondary}</p>}
                  {c.note && <p className="menu-cat-note">{c.note}</p>}
                </header>
                <ul className="menu-items">
                  {c.items.map((item) => {
                    const text = menuDescription(item, locale);
                    return (
                      <li key={item.id}>
                        <MenuItemIcon itemName={item.name} categorySlug={c.slug} />
                        <div className="menu-item-body">
                          <p className="menu-item-line">
                            <strong>{item.name}</strong>
                            {/* Dotted leader from the name to the price, as on a printed carta. */}
                            <span className="menu-item-leader" aria-hidden="true" />
                            {item.price_label && <span className="menu-item-price">{item.price_label}</span>}
                          </p>
                          {item.subtitle && <em className="menu-item-subtitle">{item.subtitle}</em>}
                          {/* An untranslated description is still German, so it says so to a
                              screen reader rather than being announced in the page's language. */}
                          {text && <small lang={isUntranslated(item, locale) ? "de" : undefined}>{text}</small>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>

          <p className="menu-note">
            {t.note} <em>{t.noteEmphasis}</em>
          </p>
          <p className="menu-cta">
            <Link className="button" href={localeHref(locale, "/#reservieren")}>
              {t.cta}
            </Link>
          </p>
        </section>
      </main>

      <SiteFooter locale={locale} />
    </div>
  );
}
