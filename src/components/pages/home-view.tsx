import { cacheLife } from "next/cache";
import Image from "next/image";
import Link from "next/link";
import { ArgentinaIcon, ClockIcon, MailIcon, MenuIcon, PhoneIcon, PinIcon } from "@/components/icons";
import { Logo } from "@/components/logo";
import { SiteFooter } from "@/components/site-footer";
import { InstagramIcon } from "@/components/instagram-icon";
import { JsonLd } from "@/components/json-ld";
import { PhotoStrip } from "@/components/photo-strip";
import { Repulgue } from "@/components/repulgue";
import { ShareButton } from "@/components/share-button";
import { SpecialsOptin } from "@/components/specials-optin";
import { SiteHeader } from "@/components/site-header";
import { VenueMap } from "@/components/venue-map";
import { ReservationForm } from "@/components/reservation-form";
import { CONTACT, whatsappHref } from "@/lib/contact";
import { addDays, todayISO } from "@/lib/dates";
import { getDictionary } from "@/lib/dictionaries";
import { localeHref, type Locale } from "@/lib/i18n";
import { restaurantJsonLd } from "@/lib/structured-data";
import {
  fmtTime,
  getActiveSpecials,
  getAnnouncement,
  getHomePhotos,
  getMenu,
  getOpeningHours,
  getReservationSettings,
} from "@/lib/data";
import { getInstagramPosts } from "@/lib/instagram";

export const HOME_PATH = "/";

/** Spanish in every locale on purpose: it is the shop talking, not the page.
 *
 *  Repeated so one copy of the track is wider than any viewport. Three phrases alone are about
 *  700px, which left half a screen of nothing between them on a desktop and read as scattered
 *  words rather than a ribbon. */
const PHRASES = ["Empanadas hechas a mano", "Pastelería argentina", "Un pedacito de Argentina"];
const MARQUEE = Array.from({ length: 6 }, (_, i) => PHRASES.map((p) => ({ key: `${i}-${p}`, text: p }))).flat();

export async function HomeView({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).home;
  const href = (path: string) => localeHref(locale, path);
  const [announcement, menu, specials, hours, reservation, photos, instagram] = await Promise.all([
    getAnnouncement(),
    getMenu(),
    getActiveSpecials(),
    getOpeningHours(),
    getReservationSettings(),
    getHomePhotos(),
    getInstagramPosts(),
  ]);

  // Featured items on the home page; the full list lives behind each category.
  const featured = menu.flatMap((c) => c.items.filter((i) => i.is_featured).map((i) => ({ ...i, category: c })));
  const cards = featured.length ? featured : menu.flatMap((c) => c.items.slice(0, 1).map((i) => ({ ...i, category: c })));

  return (
    <div className="site">
      <JsonLd data={restaurantJsonLd(hours)} />
      {announcement && <div className="announcement">{announcement}</div>}
      <SiteHeader whatsappHref={whatsappHref()} locale={locale} path={HOME_PATH} />

      <main id="main">
        <section className="hero" aria-labelledby="hero-title">
          {/* The largest thing above the fold, so it is the LCP element and worth preloading.
              alt="" on purpose: it is the backdrop to the heading, not information of its own. */}
          <Image
            className="hero-image"
            src="/assets/hero-pasteleria.jpg"
            alt=""
            fill
            priority
            sizes="(max-width: 1392px) 100vw, 1392px"
          />
          <div className="hero-content">
            {/* One span, so the sentence is a single flex item that wraps like text. As three loose
                items, a narrow screen broke it into two ragged columns either side of the flag. */}
            <p className="eyebrow">
              <span className="eyebrow-text">
                {t.heroEyebrowBefore}
                <ArgentinaIcon />
                {t.heroEyebrowAfter}
              </span>
            </p>
            {/* Each line is its own block so the two can rise in one after the other. */}
            <h1 id="hero-title">
              <span className="hero-line">{t.heroTitleLine1}</span>
              <em className="hero-line">{t.heroTitleLine2}</em>
            </h1>
            <p className="hero-text">{t.heroText}</p>
            <div className="hero-actions">
              <a className="button button-light" href="#reservieren">
                {t.heroReserve} <span aria-hidden="true">↓</span>
              </a>
              <Link className="text-link" href={href("/karte")}>
                {t.heroMenu}
              </Link>
            </div>
          </div>
          <div className="hero-note">
            <span>{t.heroNote}</span>
            <Logo />
          </div>
        </section>

        {/* Decorative: the visual track repeats the phrases six times so it is wider than any
            viewport, which would mean hearing each one six times. The track is hidden from
            assistive technology and the phrases are offered once, in order, instead. */}
        <div className="marquee">
          <p className="sr-only">{`${t.marqueeLabel}: ${PHRASES.join(". ")}.`}</p>
          <div className="marquee-track" aria-hidden="true">
            <div className="marquee-inner">
              {MARQUEE.map((phrase) => (
                <span key={phrase.key}>{phrase.text}</span>
              ))}
            </div>
            <div className="marquee-inner">
              {MARQUEE.map((phrase) => (
                <span key={phrase.key}>{phrase.text}</span>
              ))}
            </div>
          </div>
        </div>

        <section className="section" id="geschichte">
          <div className="intro-grid">
            <div className="intro-art">
              <Logo alt="La Cordobesa Pastelería Argentina" />
              <span className="art-caption">{t.storyArtCaption}</span>
            </div>
            <div className="intro-copy">
              <p className="eyebrow">{t.storyEyebrow}</p>
              <h2>{t.storyTitle}</h2>
              <p>{t.storyP1}</p>
              <p>
                {t.storyP2} <em>{t.storyP2Emphasis}</em>
              </p>
              <p className="signature">{t.storySignature}</p>
            </div>
          </div>
        </section>

        <section className="menu-section pattern-stars" id="karte">
          <div className="inner">
            <div className="section-heading">
              <p className="eyebrow">{t.menuEyebrow}</p>
              <h2>{t.menuTitle}</h2>
              <Repulgue className="repulgue-divider" />
              <p>{t.menuText}</p>
            </div>

            {specials.length > 0 && (
              <div className="specials" id="specials">
                {specials.map((s) => (
                  <div className="special" key={s.id}>
                    <span className="tag">{t.specialTag}</span>
                    <div>
                      <strong>{s.title}</strong>
                      {s.description && <p>{s.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Right under the specials, which is where somebody has just seen what they would be
                signing up for. An anchor target, since the abmelden page links back here. */}
            <div id={specials.length > 0 ? undefined : "specials"}>
              <SpecialsOptin locale={locale} />
            </div>

            <div className="menu-grid">
              {cards.map((item, i) => (
                <article className="menu-card" key={item.id}>
                  <div>
                    <span className="dish-number">
                      {String(i + 1).padStart(2, "0")} / {item.category.label}
                    </span>
                    <span className="dish-icon">
                      <MenuIcon slug={item.category.slug} />
                    </span>
                    <h3>
                      {item.name}
                      {item.subtitle && <span>{item.subtitle}</span>}
                    </h3>
                    {item.description && <p>{item.description}</p>}
                  </div>
                  {item.price_label && <span className="price">{item.price_label}</span>}
                  {/* Crimped shut on hover, the way the dish itself is finished. */}
                  <Repulgue folds={30} className="menu-card-edge" />
                </article>
              ))}
            </div>
            <p className="menu-more">
              <Link className="button" href={href("/karte")}>
                {t.menuFull} <span aria-hidden="true">→</span>
              </Link>
            </p>
          </div>
        </section>

        <PhotoStrip locale={locale} featured={photos.featured} posts={instagram} />

        <section className="craft">
          <div className="section craft-grid">
            <div>
              <p className="eyebrow">{t.craftEyebrow}</p>
              <h2>{t.craftTitle}</h2>
              <p>{t.craftText}</p>
              <a className="text-link inline-icon" href={CONTACT.instagram} target="_blank" rel="noreferrer">
                <InstagramIcon /> {t.craftLink}
              </a>
            </div>
            <div className="craft-tag">
              <strong>{t.craftEyebrow}</strong>
              <span>{t.craftTag}</span>
            </div>
          </div>
        </section>

        <section className="reserve-section" id="reservieren">
          <div className="section reserve-grid">
            <div className="reserve-copy">
              <p className="eyebrow">{t.reserveEyebrow}</p>
              <h2>{t.reserveTitle}</h2>
              {/* The phone sits here rather than in the navbar: the moment somebody wants to call is
                  the moment they are halfway through picking a date and would rather just ask. */}
              <a className="reserve-call" href={`tel:${CONTACT.phoneE164}`}>
                <PhoneIcon size={16} />
                <span>
                  {t.reserveCallPrefix}
                  <strong>{CONTACT.phoneDisplay}</strong>
                </span>
              </a>
            </div>
            {reservation.enabled ? (
              <ReservationForm
                locale={locale}
                maxPartySize={reservation.max_party_size}
                {...(await dateBounds(reservation.max_days_ahead))}
                closedWeekdays={hours.filter((h) => h.is_closed || !h.opens || !h.closes).map((h) => h.weekday)}
                phoneHref={`tel:${CONTACT.phoneE164}`}
                phoneLabel={CONTACT.phoneDisplay}
              />
            ) : (
              <div className="form-success">
                <strong>{t.reserveClosedTitle}</strong>
                <p>
                  {t.reserveClosedText}
                  <a href={`tel:${CONTACT.phoneE164}`}>{CONTACT.phoneDisplay}</a>
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="section" id="besuch">
          <div className="visit">
            <div className="visit-copy">
              <p className="eyebrow">{t.visitEyebrow}</p>
              <h2>{t.visitHeading}</h2>
              <p className="visit-intro">{t.visitIntro}</p>
              <div className="visit-card">
                <h3>{CONTACT.name}</h3>
                <div className="contact-row">
                  <span className="contact-icon">
                    <PinIcon />
                  </span>
                  <div>
                    <small>{t.visitAddressLabel}</small>
                    <address>
                      {CONTACT.street}
                      <br />
                      {CONTACT.city}
                    </address>
                  </div>
                </div>
                <div className="contact-row">
                  <span className="contact-icon">
                    <ClockIcon />
                  </span>
                  <div>
                    <small>{t.visitHours}</small>
                    <div className="hours">
                      {[1, 2, 3, 4, 5, 6, 0].map((wd) => {
                        const h = hours.find((x) => x.weekday === wd);
                        return (
                          <div key={wd} style={{ display: "contents" }}>
                            <span>{t.weekdays[wd]}</span>
                            {!h || h.is_closed ? (
                              <span className="closed">{t.closedLabel}</span>
                            ) : (
                              <span>{t.hoursRange(fmtTime(h.opens), fmtTime(h.closes))}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div className="contact-row">
                  <span className="contact-icon">
                    <PhoneIcon />
                  </span>
                  <div>
                    <small>{t.callLabel}</small>
                    <a href={`tel:${CONTACT.phoneE164}`}>{CONTACT.phoneDisplay}</a>
                  </div>
                </div>
                <div className="contact-row">
                  <span className="contact-icon">
                    <MailIcon />
                  </span>
                  <div>
                    <small>{t.writeLabel}</small>
                    <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
                  </div>
                </div>
                <div className="visit-actions">
                  <a className="button" href={whatsappHref()} target="_blank" rel="noreferrer">
                    WhatsApp <span aria-hidden="true">↗</span>
                  </a>
                  <a className="button secondary" href={CONTACT.mapsUrl} target="_blank" rel="noreferrer">
                    {t.visitRoute} <span aria-hidden="true">↗</span>
                  </a>
                  <ShareButton
                    locale={locale}
                    title={t.shareTitle(CONTACT.name)}
                    text={t.shareText}
                  />
                </div>
              </div>
            </div>
            <a className="visit-photo" href={CONTACT.instagram} target="_blank" rel="noreferrer" aria-label={t.instagramAria}>
              <Image
                src={photos.hero?.image_url ?? "/assets/hero-pasteleria.jpg"}
                alt={
                  photos.hero?.caption ?? (photos.hero ? t.galleryPhotoAlt : t.heroPhotoAlt)
                }
                fill
                sizes="(max-width: 800px) 100vw, 55vw"
              />
              <span className="photo-caption inline-icon">
                <InstagramIcon size={15} /> {t.photoCaption} · {CONTACT.instagramHandle}
              </span>
            </a>
          </div>
          <VenueMap
            locale={locale}
            query={`${CONTACT.name}, ${CONTACT.street}, ${CONTACT.city}`}
            label={`${CONTACT.street}, ${CONTACT.city}`}
            openUrl={CONTACT.mapsUrl}
          />
        </section>
      </main>

      <SiteFooter locale={locale} />
    </div>
  );
}

/** Date-picker bounds. Baked into the static shell for up to an hour; the RPC re-validates anyway. */
async function dateBounds(maxDaysAhead: number) {
  "use cache";
  cacheLife("hours");
  const today = todayISO();
  return { minDate: today, maxDate: addDays(today, maxDaysAhead) };
}
