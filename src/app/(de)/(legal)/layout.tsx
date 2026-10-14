import Link from "next/link";
import { Suspense } from "react";
import { LegalBackLink, LegalBrandLink, LegalFooterLinks } from "@/components/legal-back";
import { Logo } from "@/components/logo";

export default function LegalLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="site">
      <header className="site-header">
        <div className="nav">
          {/* Both ways home read `?von=`, so a reader who arrived from /es goes back to /es rather
              than being moved to the German site. Suspense because that reads the URL. */}
          <Suspense
            fallback={
              <Link className="brand" href="/">
                <Logo />
                <span className="brand-copy">
                  <strong>La Cordobesa</strong>
                  <small>Pastelería Argentina</small>
                </span>
              </Link>
            }
          >
            <LegalBrandLink>
              <Logo />
              <span className="brand-copy">
                <strong>La Cordobesa</strong>
                <small>Pastelería Argentina</small>
              </span>
            </LegalBrandLink>
          </Suspense>
          <Suspense fallback={null}>
            <LegalBackLink />
          </Suspense>
        </div>
      </header>
      <main id="main" className="legal">
        {children}
      </main>
      <footer className="site-footer legal-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <Logo /> La Cordobesa
          </div>
          <div className="footer-links">
            <Suspense
              fallback={
                <>
                  <Link href="/impressum">Impressum</Link>
                  <Link href="/datenschutz">Datenschutz</Link>
                </>
              }
            >
              <LegalFooterLinks />
            </Suspense>
          </div>
        </div>
      </footer>
    </div>
  );
}
