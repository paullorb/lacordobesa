import Link from "next/link";
import { PreorderForm, type PickupWindow } from "@/components/preorder-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { CONTACT, whatsappHref } from "@/lib/contact";
import { fmtTime, getAnnouncement, getClosures, getOpeningHours } from "@/lib/data";
import { getDictionary } from "@/lib/dictionaries";
import { localeHref, type Locale } from "@/lib/i18n";
import { getPickupRange, getPreorderableItems, getPreorderSettings } from "@/lib/preorders";

export const PREORDER_PATH = "/vorbestellen";

export async function PreorderView({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).preorderPage;
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
      <SiteHeader whatsappHref={whatsappHref()} locale={locale} path={PREORDER_PATH} />

      <main id="main">
        <section className="section">
          <div className="preorder-shell">
            <div className="section-heading">
              <p className="eyebrow">{t.eyebrow}</p>
              <h1>{t.heading}</h1>
              <p>{t.intro}</p>
            </div>

            {open ? (
              <PreorderForm
                locale={locale}
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
                  {t.closedBefore}
                  <a href={`tel:${CONTACT.phoneE164}`}>{CONTACT.phoneDisplay}</a>
                  {t.closedMiddle}
                  <a href={whatsappHref()} target="_blank" rel="noreferrer">
                    WhatsApp
                  </a>
                  {t.closedAfter}
                </p>
              </div>
            )}

            <p className="form-note">
              {t.footerBefore}
              <Link href={localeHref(locale, "/#reservieren")}>{t.footerReserve}</Link>
              {t.footerMiddle}
              <Link href={localeHref(locale, "/karte")}>{t.footerMenu}</Link>
              {t.footerAfter}
            </p>
          </div>
        </section>
      </main>

      <SiteFooter locale={locale} />
    </div>
  );
}
