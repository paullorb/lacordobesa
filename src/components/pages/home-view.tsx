import { cacheLife } from "next/cache";
import Image from "next/image";
import Link from "next/link";
import { ArgentinaIcon, ClockIcon, MailIcon, MenuIcon, PhoneIcon, PinIcon } from "@/components/icons";
import { Logo } from "@/components/logo";
import { SiteFooter } from "@/components/site-footer";
import { InstagramIcon } from "@/components/instagram-icon";
import { JsonLd } from "@/components/json-ld";
import { PhotoStrip } from "@/components/photo-strip";
import { OpenStatus } from "@/components/open-status";
import { EmpanadaMark, Repulgue } from "@/components/repulgue";
import { ShareButton } from "@/components/share-button";
import { SpecialsOptin } from "@/components/specials-optin";
import { SiteHeader } from "@/components/site-header";
import { VenueMap } from "@/components/venue-map";
import { ReservationForm } from "@/components/reservation-form";
import { CONTACT, whatsappHref } from "@/lib/contact";
import { addDays, todayISO } from "@/lib/dates";
import { getDictionary } from "@/lib/dictionaries";
import { INTL_LOCALE, localeHref, type Locale } from "@/lib/i18n";
import { isUntranslated, menuDescription } from "@/lib/menu-text";
import { REVIEWS } from "@/lib/reviews";
import { restaurantJsonLd } from "@/lib/structured-data";
import {
  fmtTime,
  getActiveSpecials,
  getAnnouncement,
  getHomePhotos,
  getMenu,
  getOpeningHours,
  getReservationSettings,
  getUpcomingClosures,
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
  const [announcement, menu, specials, hours, closures, reservation, photos, instagram] = await Promise.all([
    getAnnouncement(),
    getMenu(),
    getActiveSpecials(),
    getOpeningHours(),
    getUpcomingClosures(),
    getReservationSettings(),
    getHomePhotos(),
    getInstagramPosts(),
  ]);

  // The open-now status runs in the browser, so it gets just the fields it reads.
  const openingHours = hours.map(({ weekday, opens, closes, is_closed }) => ({ weekday, opens, closes, is_closed }));

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
            <OpenStatus hours={openingHours} closures={closures} locale={locale} />
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
              {/* The caption runs round the mark as a slowly turning ring, like the stamp on a box
                  of alfajores. Decorative: the same words are not information of their own. */}
              <svg className="art-ring" viewBox="0 0 400 400" aria-hidden="true" focusable="false">
                <defs>
                  <path id="art-ring-path" d="M200 200m-172 0a172 172 0 1 1 344 0a172 172 0 1 1 -344 0" />
                </defs>
                <text>
                  <textPath href="#art-ring-path" textLength={1078} lengthAdjust="spacing">
                    {`${t.storyArtCaption} · Pastelería Argentina · Frankfurt am Main · `}
                  </textPath>
                </text>
              </svg>
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
                    {menuDescription(item, locale) && (
                      <p lang={isUntranslated(item, locale) ? "de" : undefined}>{menuDescription(item, locale)}</p>
                    )}
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
            {/* The signature at full size: an empanada closed with its repulgue, drawn in as it
                scrolls into view. It replaces a second copy of the hero photo. */}
            <figure className="craft-art">
              <EmpanadaMark />
              <figcaption>{t.craftTag}</figcaption>
            </figure>
          </div>
        </section>

        <section className="section reviews" aria-labelledby="reviews-title">
          <div className="reviews-copy">
            <p className="eyebrow">{t.reviewsEyebrow}</p>
            <h2 id="reviews-title">{t.reviewsTitle}</h2>
            <p>{t.reviewsText}</p>
          </div>
          <ul className="reviews-list">
            {REVIEWS.map((r) => (
              <li key={r.name}>
                <a className="review-card" href={r.url} target="_blank" rel="noreferrer">
                  <strong>{r.name}</strong>
                  {r.score && <span className="review-score">{t.reviewsScore(r.score.value, r.score.scale, r.score.count)}</span>}
                  {/* The score is a hand-copied snapshot, so say when it was read rather than pass it off as live. */}
                  {r.score && r.checked && (
                    <span className="review-checked">
                      {t.reviewsAsOf(
                        new Intl.DateTimeFormat(INTL_LOCALE[locale], { month: "long", year: "numeric", timeZone: "UTC" }).format(
                          new Date(`${r.checked}T00:00:00Z`),
                        ),
                      )}
                    </span>
                  )}
                  <span className="review-open">
                    {t.reviewsOpen} <span aria-hidden="true">↗</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
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
                    <OpenStatus hours={openingHours} closures={closures} locale={locale} className="open-status-inline" />
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
            {/* The wrapper is the grid cell and stretches to the contact card beside it; the photo
                inside is shorter and sticky, so it rides along as the card is read instead of
                leaving half a column of empty cream under it. */}
            <div className="visit-media">
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

/** Date-picker bounds. Baked into the static shell, so the clock is only read when the entry is
 *  refreshed, and the RPC re-validates the date anyway.
 *
 *  "minutes" rather than "hours": the "hours" profile keeps an entry usable for a *day*, so the
 *  first visitor after midnight was handed yesterday as the earliest bookable date. The calendar
 *  corrects that against the browser's own clock as well; this keeps the server's answer from
 *  being a day out in the first place. */
async function dateBounds(maxDaysAhead: number) {
  "use cache";
  cacheLife("minutes");
  const today = todayISO();
  return { minDate: today, maxDate: addDays(today, maxDaysAhead) };
}
