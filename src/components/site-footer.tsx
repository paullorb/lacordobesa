import { cacheLife } from "next/cache";
import Link from "next/link";
import { CONTACT } from "@/lib/contact";
import { todayISO } from "@/lib/dates";
import { Logo } from "@/components/logo";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <Logo /> La Cordobesa
        </div>
        <div className="footer-links">
          <Link href="/#geschichte">Nuestra historia</Link>
          <Link href="/karte">Carta / Karte</Link>
          <Link href="/gallery">Galerie</Link>
          <Link href="/#reservieren">Reservieren</Link>
          <Link href="/#besuch">Kontakt</Link>
          <a href={CONTACT.instagram} target="_blank" rel="noreferrer">
            Instagram ↗
          </a>
          <Link href="/impressum">Impressum</Link>
          <Link href="/datenschutz">Datenschutz</Link>
        </div>
        <div className="copyright">
          © <Year /> La Cordobesa
          <br />
          Con mucho amor, desde Frankfurt.
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
