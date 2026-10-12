"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { EmpanadaIcon } from "@/components/empanada-icon";
import { Logo } from "@/components/logo";

const LINKS = [
  { href: "/#geschichte", label: "Unsere Geschichte" },
  { href: "/karte", label: "Carta / Karte" },
  { href: "/vorbestellen", label: "Vorbestellen" },
  { href: "/catering", label: "Feiern" },
  { href: "/gallery", label: "Galerie" },
  { href: "/#besuch", label: "Besuch uns" },
];

type Props = { whatsappHref: string; phoneHref: string };

export function SiteHeader({ whatsappHref, phoneHref }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="site-header">
      <div className="nav">
        <Link className="brand" href="/" aria-label="La Cordobesa Startseite">
          <Logo />
          <span className="brand-copy">
            <strong>La Cordobesa</strong>
            <small>Pastelería Argentina</small>
          </span>
        </Link>
        <nav id="navigation" className={`site-nav${open ? " open" : ""}`} onClick={() => setOpen(false)}>
          {LINKS.map((l) => (
            <SectionLink key={l.href} href={l.href}>
              {l.label}
            </SectionLink>
          ))}
          <a className="nav-cta" href={whatsappHref} target="_blank" rel="noreferrer">
            Schreib uns <span aria-hidden="true">↗</span>
          </a>
        </nav>
        <div className="nav-actions">
          <a className="nav-call" href={phoneHref} aria-label="Anrufen">
            <span aria-hidden="true">☎</span>
            <span className="nav-call-label">Anrufen</span>
          </a>
          <SectionLink className="nav-cta nav-reserve" href="/#reservieren">
            Reservieren
          </SectionLink>
          <button
            className="menu-toggle"
            aria-label={open ? "Menü schließen" : "Menü öffnen"}
            aria-expanded={open}
            aria-controls="navigation"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <span className="menu-close" aria-hidden="true">×</span> : <EmpanadaIcon />}
          </button>
        </div>
      </div>
    </header>
  );
}

type SectionLinkProps = { href: string; className?: string; children: ReactNode };

/**
 * A `/#anchor` link. `next/link` only scrolls when the route actually changes, so on the page the
 * anchor already lives on the jump is done here instead; otherwise the link does nothing at all.
 */
function SectionLink({ href, className, children }: SectionLinkProps) {
  const pathname = usePathname();
  const [path, hash] = href.split("#");

  if (!hash || path !== pathname) {
    return (
      <Link className={className} href={href}>
        {children}
      </Link>
    );
  }

  return (
    <a
      className={className}
      href={`#${hash}`}
      onClick={(e) => {
        const target = document.getElementById(hash);
        if (!target) return; // no such section here: let the browser handle it
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        history.replaceState(null, "", `#${hash}`);
      }}
    >
      {children}
    </a>
  );
}
