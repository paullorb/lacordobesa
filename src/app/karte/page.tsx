import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { CONTACT, whatsappHref } from "@/lib/contact";
import { getActiveSpecials, getAnnouncement, getMenu } from "@/lib/data";

export const metadata: Metadata = {
  title: "Carta / Karte",
  description: "Die komplette Karte von La Cordobesa: Empanadas, Pasta, Grill, Desserts und Getränke – alles hausgemacht.",
};

export default async function KartePage() {
  const [announcement, menu, specials] = await Promise.all([getAnnouncement(), getMenu(), getActiveSpecials()]);

  return (
    <div className="site">
      {announcement && <div className="announcement">{announcement}</div>}
      <SiteHeader whatsappHref={whatsappHref()} phoneHref={`tel:${CONTACT.phoneE164}`} />

      <main>
        <section className="menu-section">
          <div className="inner">
            <div className="section-heading">
              <p className="eyebrow">De nuestra cocina</p>
              <h1>Carta / Karte</h1>
              <p>Alles hausgemacht, nach argentinischer Art zubereitet.</p>
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
                      {c.items.map((item) => (
                        <li key={item.id}>
                          <span>
                            <strong>{item.name}</strong>
                            {item.subtitle && <em> · {item.subtitle}</em>}
                            {item.description && <small>{item.description}</small>}
                          </span>
                          {item.price_label && <span className="full-menu-price">{item.price_label}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
            </div>
            <p className="menu-note">
              Alle unsere Gerichte sind hausgemacht, ohne Konservierungsstoffe oder Zusatzstoffe. Bei Allergien oder
              Unverträglichkeiten wende dich bitte an unser Personal. <em>¡Buen provecho!</em>
            </p>
            <p className="menu-cta">
              <Link className="button" href="/#reservieren">
                Tisch reservieren
              </Link>
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
