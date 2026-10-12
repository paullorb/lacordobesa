import { cacheLife } from "next/cache";
import Link from "next/link";
import { CONTACT } from "@/lib/contact";
import { todayISO } from "@/lib/dates";
import { InstagramIcon } from "@/components/instagram-icon";
import { Logo } from "@/components/logo";
import { getDictionary } from "@/lib/dictionaries";
import { localeHref, type Locale } from "@/lib/i18n";
import { legalHref } from "@/lib/legal-links";

export function SiteFooter({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).footer;
  const href = (path: string) => localeHref(locale, path);
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <Logo /> La Cordobesa
        </div>
        <div className="footer-links">
          <Link href={href("/#geschichte")}>{t.story}</Link>
          <Link href={href("/karte")}>{t.menu}</Link>
          <Link href={href("/vorbestellen")}>{t.preorder}</Link>
          <Link href={href("/catering")}>{t.celebrate}</Link>
          <Link href={href("/gallery")}>{t.gallery}</Link>
          <Link href={href("/#reservieren")}>{t.reserve}</Link>
          <Link href={href("/#besuch")}>{t.contact}</Link>
          <a className="inline-icon" href={CONTACT.instagram} target="_blank" rel="noreferrer">
            <InstagramIcon size={14} /> Instagram
          </a>
          {/* Impressum and Datenschutzerklärung stay German in every locale: the German text is the
              legally binding one, and a translated version would be a second thing to keep correct.
              `?von=` is how they hand the reader back to the language they arrived in, since the
              pages themselves sit outside the locale route groups. */}
          <Link href={legalHref("/impressum", locale)}>{t.imprint}</Link>
          <Link href={legalHref("/datenschutz", locale)}>{t.privacy}</Link>
        </div>
        <div className="copyright">
          © <Year /> La Cordobesa
          <br />
          {t.madeWith}
        </div>
      </div>
    </footer>
  );
}

async function Year() {
  "use cache";
  cacheLife("days");
  return <>{todayISO().slice(0, 4)}</>;
}
