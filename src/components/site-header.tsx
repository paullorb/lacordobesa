"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { EmpanadaIcon } from "@/components/empanada-icon";
import { LanguageSwitch } from "@/components/language-switch";
import { Logo } from "@/components/logo";
import { getDictionary } from "@/lib/dictionaries";
import { localeHref, type Locale } from "@/lib/i18n";

type Props = { whatsappHref: string; locale: Locale; path?: string };

/** `path` is the locale-independent path of the current page ("/karte"), which the language switch
 *  needs to offer the same page in another language rather than always sending people home. */
export function SiteHeader({ whatsappHref, locale, path = "/" }: Props) {
  const [open, setOpen] = useState(false);
  const header = useRef<HTMLElement>(null);
  const t = getDictionary(locale);
  const href = (p: string) => localeHref(locale, p);
  const links = [
    { href: href("/#geschichte"), label: t.nav.story },
    { href: href("/karte"), label: t.nav.menu },
    { href: href("/vorbestellen"), label: t.nav.preorder },
    { href: href("/catering"), label: t.nav.celebrate },
    { href: href("/gallery"), label: t.nav.gallery },
    { href: href("/#besuch"), label: t.nav.visit },
  ];

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    // The menu only exists below 1320px; widening the window past that would leave the page
    // scroll-locked behind a menu that is no longer there.
    const wide = window.matchMedia("(min-width: 1321px)");
    const onWide = () => wide.matches && setOpen(false);
    // Lock the page behind the open menu, so a swipe scrolls the menu rather than the page under it.
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    // The menu hangs from the header's bottom edge, which sits lower while the announcement bar is
    // still on screen. Sized from where it really starts, so its last links stay reachable with
    // the page locked behind it.
    const bottom = header.current?.getBoundingClientRect().bottom;
    if (bottom) root.style.setProperty("--menu-top", `${Math.round(bottom)}px`);
    window.addEventListener("keydown", onKey);
    wide.addEventListener("change", onWide);
    return () => {
      root.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
      wide.removeEventListener("change", onWide);
    };
  }, [open]);

  return (
    <>
      <header className="site-header" ref={header}>
        {/* First focusable thing on the page, visible only once focused. Every <main> carries id="main". */}
        <a className="skip-link" href="#main">
          {t.nav.skipToContent}
        </a>
        <div className="nav">
          <Link className="brand" href={href("/")} aria-label={t.nav.home}>
            <Logo />
            <span className="brand-copy">
              <strong>La Cordobesa</strong>
              <small>Pastelería Argentina</small>
            </span>
          </Link>
          <nav id="navigation" className={`site-nav${open ? " open" : ""}`} onClick={() => setOpen(false)}>
            {links.map((l) => (
              <SectionLink key={l.href} href={l.href}>
                {l.label}
              </SectionLink>
            ))}
            <a className="nav-cta" href={whatsappHref} target="_blank" rel="noreferrer">
              {t.nav.write} <span aria-hidden="true">↗</span>
            </a>
            <LanguageSwitch locale={locale} path={path} label={t.nav.language} />
          </nav>
          <div className="nav-actions">
            <SectionLink className="nav-cta nav-reserve" href={href("/#reservieren")}>
              {t.nav.reserve}
            </SectionLink>
            <button
              className="menu-toggle"
              aria-label={open ? t.nav.closeMenu : t.nav.openMenu}
              aria-expanded={open}
              aria-controls="navigation"
              onClick={() => setOpen((o) => !o)}
            >
              {open ? <span className="menu-close" aria-hidden="true">×</span> : <EmpanadaIcon />}
            </button>
          </div>
        </div>
      </header>
      {open && <div className="nav-backdrop" aria-hidden="true" onClick={() => setOpen(false)} />}
    </>
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
    // A page link (no #section) says when it is the page being shown, which both reads out to a
    // screen reader and lets the nav underline where the visitor is.
    return (
      <Link className={className} href={href} aria-current={!hash && path === pathname ? "page" : undefined}>
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
