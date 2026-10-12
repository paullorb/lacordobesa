import Link from "next/link";

export default function LegalLayout({ children }: LayoutProps<"/"> ) {
  return (
    <div className="site">
      <header className="site-header">
        <div className="nav">
          <Link className="brand" href="/" aria-label="Zur Startseite">
            <img src="/assets/logo.svg" alt="" />
            <span className="brand-copy">
              <strong>La Cordobesa</strong>
              <small>Pastelería Argentina</small>
            </span>
          </Link>
          <Link href="/" className="text-link" style={{ color: "var(--ink)", borderColor: "var(--line)" }}>
            ← Zurück zur Startseite
          </Link>
        </div>
      </header>
      <main className="legal">{children}</main>
      <footer className="site-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <img src="/assets/logo.svg" alt="" /> La Cordobesa
          </div>
          <div className="footer-links">
            <Link href="/impressum">Impressum</Link>
            <Link href="/datenschutz">Datenschutz</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
