import { cacheLife } from "next/cache";
import Image from "next/image";
import Link from "next/link";
import { EventInquiryForm } from "@/components/event-inquiry-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { CONTACT, whatsappHref } from "@/lib/contact";
import { getAnnouncement } from "@/lib/data";
import { getDictionary } from "@/lib/dictionaries";
import { todayISO } from "@/lib/dates";
import { localeHref, type Locale } from "@/lib/i18n";

export const CATERING_PATH = "/catering";

/** In the order of `cateringPage.photos`, which carries the caption and alt text for each. */
const EVENT_PHOTOS = [
  { src: "/assets/feiern/toast.jpg", width: 1600, height: 1066, position: "58% 50%" },
  { src: "/assets/feiern/geburtstag.jpg", width: 1271, height: 1600, position: "50% 70%" },
  { src: "/assets/feiern/buffet.jpg", width: 1600, height: 1082, position: "40% 50%" },
  { src: "/assets/feiern/mesa-dulce.jpg", width: 1068, height: 1600, position: "50% 40%" },
  { src: "/assets/feiern/festlich-gedeckt.jpg", width: 1199, height: 1600, position: "50% 75%" },
  { src: "/assets/feiern/runder-tisch.jpg", width: 1600, height: 1066, position: "50% 50%" },
];

export async function CateringView({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).cateringPage;
  const [announcement, today] = await Promise.all([getAnnouncement(), earliestDate()]);

  return (
    <div className="site">
      {announcement && <div className="announcement">{announcement}</div>}
      <SiteHeader whatsappHref={whatsappHref()} locale={locale} path={CATERING_PATH} />

      <main id="main">
        <section className="section">
          <div className="preorder-shell">
            <div className="section-heading">
              <p className="eyebrow">{t.eyebrow}</p>
              <h1>{t.heading}</h1>
              <p>{t.intro}</p>
            </div>

            <ul className="event-photos">
              {EVENT_PHOTOS.map((photo, i) => (
                <li key={photo.src}>
                  <Image
                    src={photo.src}
                    alt={t.photos[i].alt}
                    width={photo.width}
                    height={photo.height}
                    sizes="(max-width: 520px) 50vw, 230px"
                    loading={i === 0 ? "eager" : "lazy"}
                    style={{ objectPosition: photo.position }}
                  />
                  <span className="event-photo-caption" aria-hidden="true">
                    {t.photos[i].caption}
                  </span>
                </li>
              ))}
            </ul>

            <ul className="idea-grid">
              {t.ideas.map((idea, i) => (
                <li key={idea.title}>
                  <span className="idea-num" aria-hidden="true">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h2>{idea.title}</h2>
                  <p>{idea.text}</p>
                </li>
              ))}
            </ul>

            <EventInquiryForm locale={locale} minDate={today} />

            <p className="form-note">
              {t.footerBefore}
              <Link href={localeHref(locale, "/#reservieren")}>{t.footerReserve}</Link>
              {t.footerMiddle}
              <Link href={localeHref(locale, "/vorbestellen")}>{t.footerPreorder}</Link>
              {t.footerMiddle2}
              <a href={`tel:${CONTACT.phoneE164}`}>{CONTACT.phoneDisplay}</a>
              {t.footerAfter}
            </p>
          </div>
        </section>
      </main>

      <SiteFooter locale={locale} />
    </div>
  );
}

/** Earliest date the picker offers. Cached like dateBounds() on the landing page: reading the clock
 *  during a prerender is not allowed, and the RPC re-validates the date anyway. "minutes", so the
 *  entry cannot survive into the next day and offer a date that has passed. */
async function earliestDate() {
  "use cache";
  cacheLife("minutes");
  return todayISO();
}
