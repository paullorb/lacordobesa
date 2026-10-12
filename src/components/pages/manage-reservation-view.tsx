import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getReservationByToken } from "@/app/reservierung/actions";
import { ManageReservation } from "@/components/manage-reservation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { CONTACT, whatsappHref } from "@/lib/contact";
import { getReservationSettings } from "@/lib/data";
import { getDictionary } from "@/lib/dictionaries";
import { addDays, todayISO } from "@/lib/dates";
import { localeHref, type Locale } from "@/lib/i18n";

export const MANAGE_PATH = "/reservierung";

export function ManageReservationView({
  locale,
  params,
}: {
  locale: Locale;
  params: PageProps<"/reservierung/[token]">["params"];
}) {
  const t = getDictionary(locale).manage;
  return (
    <div className="site" lang={locale}>
      {/* SiteHeader reads usePathname() to decide how to link its in-page anchors, which is URL data
          and so needs its own boundary on a dynamic route. */}
      <Suspense fallback={null}>
        <SiteHeader whatsappHref={whatsappHref()} locale={locale} path="/" />
      </Suspense>
      <main id="main">
        <section className="section">
          <div className="manage-shell">
            <div className="section-heading">
              <p className="eyebrow">{t.eyebrow}</p>
              <h1>{t.title}</h1>
            </div>
            <Suspense fallback={<p className="manage-hint">{t.loading}</p>}>
              <Booking locale={locale} params={params} />
            </Suspense>
            <p className="manage-hint">
              {t.questionsBefore}
              <a href={`tel:${CONTACT.phoneE164}`}>{CONTACT.phoneDisplay}</a>
              {t.questionsMiddle}
              <a href={whatsappHref()} target="_blank" rel="noreferrer">
                {t.questionsWhatsapp}
              </a>
              {t.questionsAfter}
              <Link href={localeHref(locale, "/")}>{t.homeLink}</Link>
              {t.questionsEnd}
            </p>
          </div>
        </section>
      </main>
      <SiteFooter locale={locale} />
    </div>
  );
}

async function Booking({ locale, params }: { locale: Locale; params: PageProps<"/reservierung/[token]">["params"] }) {
  const { token } = await params;
  const [reservation, settings] = await Promise.all([getReservationByToken(token), getReservationSettings()]);
  // An unknown or malformed token is a 404, not an error page: there is nothing to retry and no hint
  // worth giving about whether the token merely expired or never existed.
  if (!reservation) notFound();

  const today = todayISO();
  return (
    <ManageReservation
      locale={locale}
      token={token}
      reservation={reservation}
      maxPartySize={settings.max_party_size}
      minDate={today}
      maxDate={addDays(today, settings.max_days_ahead)}
    />
  );
}
