import { cacheLife } from "next/cache";
import Link from "next/link";
import { CONTACT } from "@/lib/contact";
import { ContactAddress, ContactEmail, ContactPhone, ContactRow } from "@/components/contact-row";
import { fmtTime, getOpeningHours } from "@/lib/data";
import { todayISO } from "@/lib/dates";
import { HeartIcon } from "@/components/icons";
import { InstagramIcon } from "@/components/instagram-icon";
import { Logo } from "@/components/logo";
import { repulgueTile } from "@/components/repulgue";
import { getDictionary } from "@/lib/dictionaries";
import { localeHref, type Locale } from "@/lib/i18n";
import { legalHref } from "@/lib/legal-links";

/** A closing page rather than a strip of links: where to find us, when we are open and how to
 *  reach us, under the brand set large. Everything someone scrolls to the bottom looking for.
 *  The labels reuse the visit section's copy, so the two never disagree. */
export async function SiteFooter({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  const t = dict.footer;
  const v = dict.home;
  const href = (path: string) => localeHref(locale, path);
  const hours = await getOpeningHours();
  return (
    <footer className="site-footer">
      <div className="footer-edge" aria-hidden="true" style={{ maskImage: repulgueTile(), WebkitMaskImage: repulgueTile() }} />
      <div className="footer-inner">
        <div className="footer-brand">
          <Logo />
          <p>
            {t.madeWithBefore}
            <HeartIcon />
            {t.madeWithAfter}
          </p>
        </div>

        <div className="footer-col">
          <ContactRow kind="address" label={v.visitAddressLabel}>
            <ContactAddress />
          </ContactRow>
          <ContactRow kind="phone" label={v.callLabel}>
            <ContactPhone />
          </ContactRow>
          <ContactRow kind="email" label={v.writeLabel}>
            <ContactEmail />
          </ContactRow>
        </div>

        <div className="footer-col">
          <ContactRow kind="hours" label={v.visitHours}>
            <dl className="footer-hours">
              {[1, 2, 3, 4, 5, 6, 0].map((wd) => {
                const h = hours.find((x) => x.weekday === wd);
                return (
                  <div key={wd}>
                    <dt>{v.weekdays[wd]}</dt>
                    <dd className={!h || h.is_closed ? "closed" : undefined}>
                      {!h || h.is_closed ? v.closedLabel : v.hoursRange(fmtTime(h.opens), fmtTime(h.closes))}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </ContactRow>
        </div>

        <ul className="footer-links">
          <li><Link href={href("/#geschichte")}>{t.story}</Link></li>
          <li><Link href={href("/karte")}>{t.menu}</Link></li>
          <li><Link href={href("/vorbestellen")}>{t.preorder}</Link></li>
          <li><Link href={href("/catering")}>{t.celebrate}</Link></li>
          <li><Link href={href("/gallery")}>{t.gallery}</Link></li>
          <li><Link href={href("/#reservieren")}>{t.reserve}</Link></li>
          <li><Link href={href("/#besuch")}>{t.contact}</Link></li>
          <li>
            <a className="inline-icon" href={CONTACT.instagram} target="_blank" rel="noreferrer">
              <InstagramIcon size={15} /> Instagram
            </a>
          </li>
        </ul>
      </div>

      {/* The name set as large as the page allows: the last thing on every page is the brand. */}
      <p className="footer-wordmark" aria-hidden="true">
        La Cordobesa
      </p>

      <div className="footer-bottom">
        <span>
          © <Year /> La Cordobesa · Pastelería Argentina
        </span>
        <span className="footer-legal">
          {/* Impressum and Datenschutzerklärung stay German in every locale: the German text is the
              legally binding one, and a translated version would be a second thing to keep correct.
              `?von=` is how they hand the reader back to the language they arrived in, since the
              pages themselves sit outside the locale route groups. */}
          <Link href={legalHref("/impressum", locale)}>{t.imprint}</Link>
          <Link href={legalHref("/datenschutz", locale)}>{t.privacy}</Link>
        </span>
      </div>
    </footer>
  );
}

async function Year() {
  "use cache";
  cacheLife("days");
  return <>{todayISO().slice(0, 4)}</>;
}
