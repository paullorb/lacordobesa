import { cacheLife } from "next/cache";
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
 *  during a prerender is not allowed, and the RPC re-validates the date anyway. */
async function earliestDate() {
  "use cache";
  cacheLife("hours");
  return todayISO();
}
