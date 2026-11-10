import { cacheLife } from "next/cache";
import Image from "next/image";
import Link from "next/link";
import { Fragment } from "react";
import { ArrowIcon, MenuIcon, PhoneIcon, PinIcon, WhatsAppIcon } from "@/components/icons";
import { ChapterNav } from "@/components/chapter-nav";
import { CheerCursor } from "@/components/cheer-cursor";
import { HeroCursor } from "@/components/hero-cursor";
import { Marquee } from "@/components/marquee";
import { OpeningHours, type HoursRow } from "@/components/opening-hours";
import { ContactAddress, ContactEmail, ContactPhone, ContactRow } from "@/components/contact-row";
import { CordobaBackdrop } from "@/components/cordoba-backdrop";
import { Logo } from "@/components/logo";
import { SiteFooter } from "@/components/site-footer";
import { InstagramIcon } from "@/components/instagram-icon";
import { JsonLd } from "@/components/json-ld";
import { PhotoStrip } from "@/components/photo-strip";
import { OpenStatus } from "@/components/open-status";
import { PhoneNote } from "@/components/phone-note";
import { Repulgue } from "@/components/repulgue";
import { ShareButton } from "@/components/share-button";
import { SiteHeader } from "@/components/site-header";
import { VenueMap } from "@/components/venue-map";
import { ReservationForm } from "@/components/reservation-form";
import { CONTACT, whatsappHref } from "@/lib/contact";
import { addDays, todayISO } from "@/lib/dates";
import { getDictionary } from "@/lib/dictionaries";
import { localeHref, type Locale } from "@/lib/i18n";
import { isUntranslated, menuDescription } from "@/lib/menu-text";
import { restaurantJsonLd } from "@/lib/structured-data";
import {
  fmtTime,
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
  const [announcement, menu, hours, closures, reservation, photos, instagram] = await Promise.all([
    getAnnouncement(),
    getMenu(),
    getOpeningHours(),
    getUpcomingClosures(),
    getReservationSettings(),
    getHomePhotos(),
    getInstagramPosts(),
  ]);

  // The open-now status runs in the browser, so it gets just the fields it reads.
  const openingHours = hours.map(({ weekday, opens, closes, is_closed }) => ({ weekday, opens, closes, is_closed }));
  const hoursRows: HoursRow[] = [1, 2, 3, 4, 5, 6, 0].map((wd) => {
    const h = hours.find((x) => x.weekday === wd);
    const closed = !h || h.is_closed || !h.opens || !h.closes;
    return { weekday: wd, label: t.weekdays[wd], text: closed ? t.closedLabel : t.hoursRange(fmtTime(h.opens), fmtTime(h.closes)), closed };
  });
  const chapters = [
    { id: "geschichte", label: t.chapters.story, icon: "story" },
    { id: "karte", label: t.chapters.menu, icon: "menu" },
    ...(photos.featured.length || instagram.length ? [{ id: "fotos", label: t.chapters.photos, icon: "gallery" }] : []),
    { id: "reservieren", label: t.chapters.reserve, icon: "reserve" },
    { id: "besuch", label: t.chapters.visit, icon: "visit" },
  ];

  // Featured items on the home page; the full list lives behind each category.
  const featured = menu.flatMap((c) => c.items.filter((i) => i.is_featured).map((i) => ({ ...i, category: c })));
  const cards = featured.length ? featured : menu.flatMap((c) => c.items.slice(0, 1).map((i) => ({ ...i, category: c })));

  return (
    <div className="site">
      <JsonLd data={restaurantJsonLd(hours, locale)} />
      {announcement && <div className="announcement">{announcement}</div>}
      <SiteHeader whatsappHref={whatsappHref()} locale={locale} path={HOME_PATH} />
      {/* Wide screens only (see .chapter-nav): the page chapters, with the current one marked. */}
      <ChapterNav label={t.chaptersLabel} chapters={chapters} />
      <CheerCursor locale={locale} />

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
            {/* One span, so the sentence is a single flex item that wraps like text. */}
            <p className="eyebrow">
              <span className="eyebrow-text">
                {t.heroEyebrow}
              </span>
            </p>
            {/* Each line is its own block and each word its own clipped box, so the headline rises
                word by word out of its own baseline. The spaces between the boxes are real text,
                so the heading still reads as two sentences. */}
            <h1 id="hero-title">
              <span className="hero-line">{words(t.heroTitleLine1, 0)}</span>
              <em className="hero-line">{words(t.heroTitleLine2, t.heroTitleLine1.split(" ").length)}</em>
            </h1>
            <p className="hero-text">{t.heroText}</p>
            <div className="hero-actions">
              <a className="button button-light" href="#reservieren">
                {t.heroReserve} <ArrowIcon direction="down" />
              </a>
              <Link className="text-link" href={href("/karte")}>
                {t.heroMenu}
              </Link>
            </div>
            <PhoneNote locale={locale} className="hero-phone" />
          </div>
          <div className="hero-note">
            <OpenStatus hours={openingHours} closures={closures} locale={locale} />
            <Logo />
          </div>
          {/* The page goes on below the fold: said by the pointer, not by a word in the corner. */}
          <HeroCursor />
        </section>

        {/* Decorative: the visual track repeats the phrases six times so it is wider than any
            viewport, which would mean hearing each one six times. The track is hidden from
            assistive technology and the phrases are offered once, in order, instead. */}
        <Marquee>
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
        </Marquee>

        <section className="section story-section" id="geschichte">
          {/* The province behind the story: a quiet map that drifts with the scroll. */}
          <CordobaBackdrop />
          <div className="intro-grid">
            <div className="intro-copy">
              <p className="eyebrow">{t.storyEyebrow}</p>
              <h2>{t.storyTitle}</h2>
              <p>{t.storyP1}</p>
              <p>{t.storyP2}</p>
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
            </div>

            <div className="menu-grid">
              {cards.map((item, i) => (
                <article className="menu-card" key={item.id} data-spotlight="" data-cheer="">
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
                {t.menuFull} <ArrowIcon direction="right" />
              </Link>
            </p>

          </div>
        </section>

        <PhotoStrip locale={locale} featured={photos.featured} posts={instagram} />

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
              <div className="visit-card">
                <h3>{CONTACT.name}</h3>
                <ContactRow kind="address" label={t.visitAddressLabel}>
                  <ContactAddress />
                </ContactRow>
                <ContactRow kind="hours" label={t.visitHours}>
                  <OpenStatus hours={openingHours} closures={closures} locale={locale} className="open-status-inline" />
                  <OpeningHours rows={hoursRows} todayLabel={t.todayMark} variant="grid" />
                </ContactRow>
                <ContactRow kind="phone" label={t.callLabel}>
                  <ContactPhone />
                </ContactRow>
                <ContactRow kind="email" label={t.writeLabel}>
                  <ContactEmail />
                </ContactRow>
                <div className="visit-actions">
                  <a className="button" href={whatsappHref()} target="_blank" rel="noreferrer">
                    <WhatsAppIcon /> WhatsApp <ArrowIcon direction="up-right" />
                  </a>
                  <a className="button secondary" href={CONTACT.mapsUrl} target="_blank" rel="noreferrer">
                    <PinIcon /> {t.visitRoute} <ArrowIcon direction="up-right" />
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

/** One clipped box per word of the headline, numbered on through both lines so the stagger does
 *  not restart on the second. The box is what the word rises out of (see .hero-word). */
function words(line: string, offset: number) {
  return line.split(" ").map((word, i) => (
    <Fragment key={word + i}>
      {i > 0 && " "}
      <span className="hero-word" style={{ "--w": offset + i } as React.CSSProperties}>
        <span>{word}</span>
      </span>
    </Fragment>
  ));
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
