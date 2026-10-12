"use client";

import { useEffect, useState } from "react";

const LINKS = [
  { href: "#geschichte", label: "Unsere Geschichte" },
  { href: "#karte", label: "Carta / Karte" },
  { href: "#reservieren", label: "Reservieren" },
  { href: "#besuch", label: "Besuch uns" },
];

export function SiteHeader({ whatsappHref }: { whatsappHref: string }) {
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
        <a className="brand" href="#start" aria-label="La Cordobesa Startseite">
          <img src="/assets/logo.svg" alt="" />
          <span className="brand-copy">
            <strong>La Cordobesa</strong>
            <small>Pastelería Argentina</small>
          </span>
        </a>
        <button
          className="menu-toggle"
          aria-label={open ? "Menü schließen" : "Menü öffnen"}
          aria-expanded={open}
          aria-controls="navigation"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "×" : "☰"}
        </button>
        <nav id="navigation" className={`site-nav${open ? " open" : ""}`} onClick={() => setOpen(false)}>
          {LINKS.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
          <a className="nav-cta" href={whatsappHref} target="_blank" rel="noreferrer">
            Schreib uns <span aria-hidden="true">↗</span>
          </a>
        </nav>
      </div>
    </header>
  );
}
