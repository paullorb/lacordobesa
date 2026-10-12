import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import Link from "next/link";
import { EventInquiryForm } from "@/components/event-inquiry-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { CONTACT, whatsappHref } from "@/lib/contact";
import { getAnnouncement } from "@/lib/data";
import { todayISO } from "@/lib/dates";

export const metadata: Metadata = {
  title: "Feiern & Catering",
  description:
    "Geburtstag, Firmenfeier, Taufe oder Catering zum Abholen: La Cordobesa richtet eure Feier mit argentinischer Küche aus, in Frankfurt am Main.",
};

const IDEAS = [
  {
    title: "Bei uns im Lokal",
    text: "Wir machen den Laden für euch frei oder reservieren den hinteren Bereich. Ihr sagt, wie viele kommen, wir machen den Rest.",
  },
  {
    title: "Mesa dulce",
    text: "Der süße Tisch, wie bei einem argentinischen Geburtstag: Alfajores, Torten, Pastelitos. Auch als Nachtisch für eine Feier woanders.",
  },
  {
    title: "Catering zum Abholen",
    text: "Empanadas blechweise, Empanadas für das Büro, Platten für zu Hause. Frisch gebacken und zur verabredeten Zeit bereit.",
  },
];

export default async function CateringPage() {
  const [announcement, today] = await Promise.all([getAnnouncement(), earliestDate()]);

  return (
    <div className="site">
      {announcement && <div className="announcement">{announcement}</div>}
      <SiteHeader whatsappHref={whatsappHref()} phoneHref={`tel:${CONTACT.phoneE164}`} />

      <main>
        <section className="section">
          <div className="preorder-shell">
            <div className="section-heading">
              <p className="eyebrow">Festejemos juntos</p>
              <h1>Feiern & Catering</h1>
              <p>
                Geburtstag, Firmenfeier, Taufe oder einfach ein Abend mit vielen Leuten: wir kochen argentinisch für
                eure Feier, bei uns im Lokal oder zum Abholen. Erzähl uns, was du vorhast, und wir machen dir einen
                Vorschlag.
              </p>
            </div>

            <ul className="idea-grid">
              {IDEAS.map((idea) => (
                <li key={idea.title}>
                  <h2>{idea.title}</h2>
                  <p>{idea.text}</p>
                </li>
              ))}
            </ul>

            <EventInquiryForm minDate={today} />

            <p className="form-note">
              Nur ein Tisch für heute Abend? <Link href="/#reservieren">Hier reservieren</Link>. Etwas zum Abholen?{" "}
              <Link href="/vorbestellen">Vorbestellen</Link>. Oder ruf uns an unter{" "}
              <a href={`tel:${CONTACT.phoneE164}`}>{CONTACT.phoneDisplay}</a>.
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
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
