import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getReservationByToken } from "@/app/reservierung/actions";
import { ManageReservation } from "@/components/manage-reservation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { CONTACT, whatsappHref } from "@/lib/contact";
import { getReservationSettings } from "@/lib/data";
import { addDays, todayISO } from "@/lib/dates";

export const metadata: Metadata = {
  title: "Deine Reservierung",
  // The token in the URL is the credential for one booking, so these pages must never be indexed
  // or sent to another site as a referrer.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function ManagePage(props: PageProps<"/reservierung/[token]">) {
  return (
    <div className="site">
      {/* SiteHeader reads usePathname() to decide how to link its in-page anchors, which is URL data
          and so needs its own boundary on a dynamic route. */}
      <Suspense fallback={null}>
        <SiteHeader whatsappHref={whatsappHref()} phoneHref={`tel:${CONTACT.phoneE164}`} />
      </Suspense>
      <main>
        <section className="section">
          <div className="manage-shell">
            <div className="section-heading">
              <p className="eyebrow">Tu reserva</p>
              <h1>Deine Reservierung</h1>
            </div>
            <Suspense fallback={<p className="manage-hint">Reservierung wird geladen …</p>}>
              <Booking params={props.params} />
            </Suspense>
            <p className="manage-hint">
              Fragen? Ruf uns an unter{" "}
              <a href={`tel:${CONTACT.phoneE164}`}>{CONTACT.phoneDisplay}</a> oder schreib uns per{" "}
              <a href={whatsappHref()} target="_blank" rel="noreferrer">
                WhatsApp
              </a>
              . Zur <Link href="/">Startseite</Link>.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

async function Booking({ params }: Pick<PageProps<"/reservierung/[token]">, "params">) {
  const { token } = await params;
  const [reservation, settings] = await Promise.all([getReservationByToken(token), getReservationSettings()]);
  // An unknown or malformed token is a 404, not an error page: there is nothing to retry and no hint
  // worth giving about whether the token merely expired or never existed.
  if (!reservation) notFound();

  const today = todayISO();
  return (
    <ManageReservation
      token={token}
      reservation={reservation}
      maxPartySize={settings.max_party_size}
      minDate={today}
      maxDate={addDays(today, settings.max_days_ahead)}
    />
  );
}
