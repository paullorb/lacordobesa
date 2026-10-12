import { cacheLife } from "next/cache";
import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ReservationForm } from "@/components/reservation-form";
import { CONTACT, whatsappHref } from "@/lib/contact";
import { addDays, todayISO } from "@/lib/dates";
import {
  fmtTime,
  getActiveSpecials,
  getAnnouncement,
  getMenu,
  getOpeningHours,
  getReservationSettings,
  WEEKDAYS_DE,
} from "@/lib/data";

const ICONS: Record<string, string> = {
  vorspeise: "🫓",
  empanadas: "🥟",
  pasta: "🍝",
  clasico: "🌭",
  pizzas: "🍕",
  hauptgerichte: "🥩",
  desserts: "🍮",
  alkoholfrei: "🥤",
  alkoholisch: "🍺",
  heiss: "☕",
  cocktails: "🍹",
};

export default async function HomePage() {
  const [announcement, menu, specials, hours, reservation] = await Promise.all([
    getAnnouncement(),
    getMenu(),
    getActiveSpecials(),
    getOpeningHours(),
    getReservationSettings(),
  ]);

  // Featured items on the home page; the full list lives behind each category.
  const featured = menu.flatMap((c) => c.items.filter((i) => i.is_featured).map((i) => ({ ...i, category: c })));
  const cards = featured.length ? featured : menu.flatMap((c) => c.items.slice(0, 1).map((i) => ({ ...i, category: c })));

  return (
    <div className="site">
      {announcement && <div className="announcement">{announcement}</div>}
      <SiteHeader whatsappHref={whatsappHref()} phoneHref={`tel:${CONTACT.phoneE164}`} />

      <main id="start">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-content">
            <p className="eyebrow">Ein Stück Argentinien in Frankfurt</p>
            <h1 id="hero-title">
              Wie zuhause.
              <br />
              <em>Con mucho amor.</em>
            </h1>
            <p className="hero-text">
              Empanadas, süße Klassiker und hausgemachte Spezialitäten – nach argentinischer Art zubereitet und in
              Frankfurt mit viel Liebe serviert.
            </p>
            <div className="hero-actions">
              <a className="button button-light" href="#reservieren">
                Tisch reservieren <span aria-hidden="true">↓</span>
              </a>
              <Link className="text-link" href="/karte">
                Zur Karte
              </Link>
            </div>
          </div>
          <div className="hero-note">
            <span>Pastelería Argentina · Frankfurt</span>
            <Logo />
          </div>
        </section>

        <div className="marquee" aria-label="Hausgemachte Spezialitäten">
          <div className="marquee-inner">
            <span>Empanadas hechas a mano</span>
            <span>Pastelería argentina</span>
            <span>Un pedacito de Argentina</span>
          </div>
        </div>

        <section className="section" id="geschichte">
          <div className="intro-grid">
            <div className="intro-art">
              <Logo alt="La Cordobesa Pastelería Argentina" />
              <span className="art-caption">Sabores de nuestra casa</span>
            </div>
            <div className="intro-copy">
              <p className="eyebrow">Unsere kleine Welt</p>
              <h2>Mit Geschmack, der Erinnerungen weckt.</h2>
              <p>
                La Cordobesa ist ein Familienprojekt – mit argentinischen Rezepten, ehrlichem Handwerk und dem Wunsch,
                ein Stück Heimat mit allen zu teilen. Bei uns duftet es nach frisch gebackenem Teig, süßen Alfajores
                und den Aromen eines langen Mittagessens am Familientisch.
              </p>
              <p>
                Ob auf einen Kaffee, eine warme Empanada oder ein Stück Kuchen: <em>¡Qué lindo tenerte acá!</em>
              </p>
              <p className="signature">Con cariño, das Team von La Cordobesa</p>
            </div>
          </div>
        </section>

        <section className="menu-section" id="karte">
          <div className="inner">
            <div className="section-heading">
              <p className="eyebrow">De nuestra cocina</p>
              <h2>Ein paar Lieblingsstücke</h2>
              <p>Von Empanadas über Steaks vom Grill bis zum Flan – alles hausgemacht. Hier ein paar unserer Highlights – die ganze Karte findest du auf einer eigenen Seite.</p>
            </div>

            {specials.length > 0 && (
              <div className="specials">
                {specials.map((s) => (
                  <div className="special" key={s.id}>
                    <span className="tag">Heute</span>
                    <div>
                      <strong>{s.title}</strong>
                      {s.description && <p>{s.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="menu-grid">
              {cards.map((item, i) => (
                <article className="menu-card" key={item.id}>
                  <div>
                    <span className="dish-number">
                      {String(i + 1).padStart(2, "0")} / {item.category.label}
                    </span>
                    <span className="dish-icon" aria-hidden="true">
                      {" "}
                      {ICONS[item.category.slug] ?? "✦"}
                    </span>
                    <h3>
                      {item.name}
                      {item.subtitle && <span>{item.subtitle}</span>}
                    </h3>
                    {item.description && <p>{item.description}</p>}
                  </div>
                  {item.price_label && <span className="price">{item.price_label}</span>}
                </article>
              ))}
            </div>
            <p className="menu-more">
              <Link className="button" href="/karte">
                Ganze Karte ansehen <span aria-hidden="true">→</span>
              </Link>
            </p>
          </div>
        </section>

        <section className="craft">
          <div className="section craft-grid">
            <div>
              <p className="eyebrow">Hecho a mano</p>
              <h2>Jede Empanada bekommt ihren eigenen Rand.</h2>
              <p>
                Teig ausrollen, füllen, verschließen – bei hausgemachten Spezialitäten steckt die Liebe oft in den
                kleinen Handgriffen. Genau diese Sorgfalt schmeckt man in jedem Bissen.
              </p>
              <a className="text-link" href={CONTACT.instagram} target="_blank" rel="noreferrer">
                Mehr aus unserer Backstube auf Instagram ↗
              </a>
            </div>
            <div className="craft-tag">
              <strong>Hecho a mano</strong>
              <span>Mit Liebe gemacht · Desde Frankfurt</span>
            </div>
          </div>
        </section>

        <section className="reserve-section" id="reservieren">
          <div className="section reserve-grid">
            <div className="reserve-copy">
              <p className="eyebrow">Reservá tu mesa</p>
              <h2>Tisch reservieren.</h2>
              <p>
                Such dir in vier kurzen Schritten Datum, Uhrzeit und Personenzahl aus – wir melden uns kurz, um die Reservierung zu bestätigen. Für
                Caterings, große Gruppen oder kurzfristige Wünsche erreichst du uns am schnellsten per{" "}
                <a href={whatsappHref()} target="_blank" rel="noreferrer">
                  WhatsApp
                </a>
                .
              </p>
            </div>
            {reservation.enabled ? (
              <ReservationForm
                maxPartySize={reservation.max_party_size}
                {...(await dateBounds(reservation.max_days_ahead))}
                closedWeekdays={hours.filter((h) => h.is_closed || !h.opens || !h.closes).map((h) => h.weekday)}
                phoneHref={`tel:${CONTACT.phoneE164}`}
                phoneLabel={CONTACT.phoneDisplay}
              />
            ) : (
              <div className="form-success">
                <strong>Gerade keine Online-Reservierung</strong>
                <p>
                  Ruf uns einfach an: <a href={`tel:${CONTACT.phoneE164}`}>{CONTACT.phoneDisplay}</a>
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="section" id="besuch">
          <div className="visit">
            <div className="visit-copy">
              <p className="eyebrow">Te esperamos</p>
              <h2>Komm vorbei. Wir freuen uns auf dich.</h2>
              <p className="visit-intro">
                Du möchtest etwas vorbestellen, hast eine Frage oder planst ein Catering? Schreib oder ruf uns einfach
                an.
              </p>
              <div className="visit-card">
                <h3>{CONTACT.name}</h3>
                <div className="contact-row">
                  <span className="contact-icon" aria-hidden="true">⌖</span>
                  <div>
                    <small>Besuch uns</small>
                    <address>
                      {CONTACT.street}
                      <br />
                      {CONTACT.city}
                    </address>
                  </div>
                </div>
                <div className="contact-row">
                  <span className="contact-icon" aria-hidden="true">◷</span>
                  <div>
                    <small>Öffnungszeiten</small>
                    <div className="hours">
                      {[1, 2, 3, 4, 5, 6, 0].map((wd) => {
                        const h = hours.find((x) => x.weekday === wd);
                        return (
                          <div key={wd} style={{ display: "contents" }}>
                            <span>{WEEKDAYS_DE[wd]}</span>
                            {!h || h.is_closed ? (
                              <span className="closed">geschlossen</span>
                            ) : (
                              <span>
                                {fmtTime(h.opens)} – {fmtTime(h.closes)}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div className="contact-row">
                  <span className="contact-icon" aria-hidden="true">☎</span>
                  <div>
                    <small>Ruf uns an</small>
                    <a href={`tel:${CONTACT.phoneE164}`}>{CONTACT.phoneDisplay}</a>
                  </div>
                </div>
                <div className="contact-row">
                  <span className="contact-icon" aria-hidden="true">✉</span>
                  <div>
                    <small>Schreib uns</small>
                    <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
                  </div>
                </div>
                <div className="visit-actions">
                  <a className="button" href={whatsappHref()} target="_blank" rel="noreferrer">
                    WhatsApp <span aria-hidden="true">↗</span>
                  </a>
                  <a className="button secondary" href={CONTACT.mapsUrl} target="_blank" rel="noreferrer">
                    Route planen <span aria-hidden="true">↗</span>
                  </a>
                </div>
              </div>
            </div>
            <a className="visit-photo" href={CONTACT.instagram} target="_blank" rel="noreferrer" aria-label="La Cordobesa auf Instagram besuchen">
              <Image
                src="/assets/hero-pasteleria.jpg"
                alt="Illustratives Stimmungsbild mit argentinischen Empanadas, Alfajores und Gebäck"
                fill
                sizes="(max-width: 800px) 100vw, 55vw"
              />
              <span className="photo-caption">Seguinos · {CONTACT.instagramHandle}</span>
            </a>
          </div>
        </section>
      </main>

      <SiteFooter />
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
