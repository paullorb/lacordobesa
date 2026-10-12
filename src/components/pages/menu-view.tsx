import Link from "next/link";
import { JsonLd } from "@/components/json-ld";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { codeList, legendFor } from "@/lib/allergens";
import { CONTACT, whatsappHref } from "@/lib/contact";
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
 *  A German sentence is more use to a Spanish reader than a blank line. */
function description(item: Tables<"menu_items">, locale: Locale) {
  if (locale === "es") return item.description_es ?? item.description;
  if (locale === "en") return item.description_en ?? item.description;
  return item.description;
}

/** True when a dish shows German text under a non-German heading, which the page then admits to. */
function isUntranslated(item: Tables<"menu_items">, locale: Locale) {
  if (locale === "de" || !item.description) return false;
  return (locale === "es" ? item.description_es : item.description_en) == null;
}

export async function MenuView({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).menuPage;
  const [announcement, menu, specials] = await Promise.all([getAnnouncement(), getMenu(), getActiveSpecials()]);

  const shown = menu.flatMap((c) => c.items);
  const legend = legendFor(shown.flatMap(allergensOf), shown.flatMap(additivesOf), locale);
  const anyUntranslated = shown.some((i) => isUntranslated(i, locale));

  return (
    <div className="site" lang={locale}>
      <JsonLd data={menuJsonLd(menu)} />
      {announcement && <div className="announcement">{announcement}</div>}
      <SiteHeader whatsappHref={whatsappHref()} locale={locale} path={MENU_PATH} />

      <main>
        <section className="menu-section">
          <div className="inner">
            <div className="section-heading">
              <p className="eyebrow">{t.eyebrow}</p>
              <h1>{t.title}</h1>
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

            <div className="full-menu">
              {menu
                .filter((c) => c.items.length > 0)
                .map((c) => (
                  <div className="full-menu-cat" key={c.id}>
                    <h2>
                      {c.label}
                      {c.label_secondary && <small>{c.label_secondary}</small>}
                    </h2>
                    {c.note && <p className="full-menu-note">{c.note}</p>}
                    <ul>
                      {c.items.map((item) => {
                        const text = description(item, locale);
                        return (
                          <li key={item.id}>
                            <span>
                              <strong>{item.name}</strong>
                              {codes(item).length > 0 && (
                                <sup className="menu-codes" aria-label={t.codesLabel(codeList(codes(item)))}>
                                  {codeList(codes(item))}
                                </sup>
                              )}
                              {item.subtitle && <em> · {item.subtitle}</em>}
                              {/* An untranslated description is still German, so it says so to a
                                  screen reader rather than being announced in the page's language. */}
                              {text && <small lang={isUntranslated(item, locale) ? "de" : undefined}>{text}</small>}
                            </span>
                            {item.price_label && <span className="full-menu-price">{item.price_label}</span>}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
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
          </div>
        </section>
      </main>

      <SiteFooter locale={locale} />
    </div>
  );
}
