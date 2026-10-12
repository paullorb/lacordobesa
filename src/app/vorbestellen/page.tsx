import type { Metadata } from "next";
import Link from "next/link";
import { PreorderForm, type PickupWindow } from "@/components/preorder-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { CONTACT, whatsappHref } from "@/lib/contact";
import { fmtTime, getAnnouncement, getClosures, getOpeningHours } from "@/lib/data";
import { getPickupRange, getPreorderableItems, getPreorderSettings } from "@/lib/preorders";

export const metadata: Metadata = {
  title: "Vorbestellen",
  description:
    "Empanadas im Dutzend, eine Torta für den Geburtstag oder ein Blech Alfajores: bestell bei La Cordobesa vor und hol alles frisch ab.",
};

export default async function PreorderPage() {
  const [announcement, items, settings, hours, { minDate, maxDate }] = await Promise.all([
    getAnnouncement(),
    getPreorderableItems(),
    getPreorderSettings(),
    getOpeningHours(),
    // The earliest pickup day the RPC would accept, so the picker does not offer a day it will reject.
    getPickupRange(),
  ]);
  const closedDates = await getClosures(minDate, maxDate);

  // Indexed by weekday so the form can look a date's window up directly.
  const windows: PickupWindow[] = Array.from({ length: 7 }, (_, weekday) => {
    const row = hours.find((h) => h.weekday === weekday);
    return row && !row.is_closed && row.opens && row.closes ? { opens: fmtTime(row.opens), closes: fmtTime(row.closes) } : null;
  });

  const open = settings.enabled && items.length > 0;

  return (
    <div className="site">
      {announcement && <div className="announcement">{announcement}</div>}
      <SiteHeader whatsappHref={whatsappHref()} phoneHref={`tel:${CONTACT.phoneE164}`} />

      <main>
        <section className="section">
          <div className="preorder-shell">
            <div className="section-heading">
              <p className="eyebrow">Encargá con tiempo</p>
              <h1>Vorbestellen und abholen</h1>
              <p>
                Empanadas im Dutzend, eine Torta für den Geburtstag, Alfajores für das Büro: sag uns, was du brauchst
                und wann du es abholen möchtest. Wir backen frisch, du bezahlst bei der Abholung.
              </p>
            </div>

            {open ? (
              <PreorderForm
                items={items}
                windows={windows}
                closedDates={closedDates}
                minDate={minDate}
                maxDate={maxDate}
                maxQuantity={settings.max_quantity}
                maxLines={settings.max_lines}
                leadHours={settings.min_lead_hours}
              />
            ) : (
              <div className="form-note-box">
                <p>
                  Vorbestellungen laufen gerade nicht über die Website. Ruf uns gern an unter{" "}
                  <a href={`tel:${CONTACT.phoneE164}`}>{CONTACT.phoneDisplay}</a> oder schreib uns per{" "}
                  <a href={whatsappHref()} target="_blank" rel="noreferrer">
                    WhatsApp
                  </a>
                  , dann klären wir alles direkt.
                </p>
              </div>
            )}

            <p className="form-note">
              Lieber einen Tisch? <Link href="/#reservieren">Hier reservieren</Link>. Die ganze Karte findest du unter{" "}
              <Link href="/karte">Carta / Karte</Link>.
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
