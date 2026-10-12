import Link from "next/link";
import { MenuIcon } from "@/components/icons";
import { JsonLd } from "@/components/json-ld";
import { MenuItemIcon } from "@/components/menu-icons";
import { Repulgue } from "@/components/repulgue";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { codeList, legendFor } from "@/lib/allergens";
import { whatsappHref } from "@/lib/contact";
import { getActiveSpecials, getAnnouncement, getMenu } from "@/lib/data";
import { getDictionary } from "@/lib/dictionaries";
import { localeHref, type Locale } from "@/lib/i18n";
import { menuJsonLd } from "@/lib/structured-data";
import type { Tables } from "@/lib/database.types";

export const MENU_PATH = "/karte";

/** The allergen/additive columns arrive with migration 20261012093136. Reading them defensively keeps
 *  the public menu rendering against a database where it has not been applied yet. */
const allergensOf = (i: Tables<"menu_items">) => i.allergens ?? [];
const additivesOf = (i: Tables<"menu_items">) => i.additives ?? [];
const codes = (i: Tables<"menu_items">) => [...allergensOf(i), ...additivesOf(i)];

/** The description in the reader's language, falling back to German (migration 20261012102608).
 *  A German sentence is more use to a Spanish reader than a blank line.
 *
 *  menu_items.description_en is still in the schema and still editable by staff; the site simply
 *  no longer offers English, so nothing reads it. Dropping the column would throw away whatever
 *  has been written into it for the sake of tidiness. */
function description(item: Tables<"menu_items">, locale: Locale) {
  return locale === "es" ? (item.description_es ?? item.description) : item.description;
}

/** True when a dish shows German text under a Spanish heading, which the page then admits to. */
function isUntranslated(item: Tables<"menu_items">, locale: Locale) {
  if (locale === "de" || !item.description) return false;
  return item.description_es == null;
}

export async function MenuView({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).menuPage;
  const [announcement, menu, specials] = await Promise.all([getAnnouncement(), getMenu(), getActiveSpecials()]);

  const shown = menu.flatMap((c) => c.items);
  const legend = legendFor(shown.flatMap(allergensOf), shown.flatMap(additivesOf), locale);
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
                    const text = description(item, locale);
                    return (
                      <li key={item.id}>
                        <MenuItemIcon itemName={item.name} categorySlug={c.slug} />
                        <div className="menu-item-body">
                          <p className="menu-item-line">
                            <strong>{item.name}</strong>
                            {codes(item).length > 0 && (
                              <sup className="menu-codes" aria-label={t.codesLabel(codeList(codes(item)))}>
                                {codeList(codes(item))}
                              </sup>
                            )}
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

          {legend.length > 0 && (
            <div className="menu-legend">
              <h2>{t.legendTitle}</h2>
              <ul>
                {legend.map((l) => (
                  <li key={l.code}>
                    <sup>{l.code}</sup> {l.label}
                  </li>
                ))}
              </ul>
            </div>
          )}
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
