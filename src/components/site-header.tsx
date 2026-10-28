"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { ArrowIcon, NavIcon, PhoneIcon, PinIcon } from "@/components/icons";
import { EmpanadaIcon } from "@/components/empanada-icon";
import { InstagramIcon } from "@/components/instagram-icon";
import { LanguageSwitch } from "@/components/language-switch";
import { Logo } from "@/components/logo";
import { PointerEffects } from "@/components/pointer-effects";
import { RouteTransition } from "@/components/route-transition";
import { MotionIconButton } from "@/components/motion-icon-button";
import { EmpanadaMark } from "@/components/repulgue";
import { CONTACT } from "@/lib/contact";
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
    { href: href("/#geschichte"), label: t.nav.story, icon: "story" },
    { href: href("/karte"), label: t.nav.menu, icon: "menu" },
    { href: href("/vorbestellen"), label: t.nav.preorder, icon: "preorder" },
    { href: href("/catering"), label: t.nav.celebrate, icon: "celebrate" },
    { href: href("/gallery"), label: t.nav.gallery, icon: "gallery" },
    { href: href("/#besuch"), label: t.nav.visit, icon: "visit" },
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
      {/* Attached here because every public page renders the header, and nowhere else is on all of them. */}
      <PointerEffects />
      <RouteTransition />
      <header className="site-header" ref={header}>
        {/* First focusable thing on the page, visible only once focused. Every <main> carries id="main". */}
        <a className="skip-link" href="#main">
          {t.nav.skipToContent}
        </a>
        {path === "/" && <MotionIconButton className="progress-empanada" animation="empanada" ariaLabel={t.home.animateEmpanada}><EmpanadaIcon /></MotionIconButton>}
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
                <NavIcon name={l.icon} className="nav-icon" />
                {l.label}
              </SectionLink>
            ))}
            <LanguageSwitch locale={locale} path={path} label={t.nav.language} />
            {/* Only in the open menu, where there is a whole screen to fill: the address, the phone
                and the Instagram handle, so the menu is a page about the shop rather than a list of
                links. The stylesheet hides it in the desktop bar, which stays words only. */}
            <div className="nav-aside">
              <p className="nav-aside-label">{t.footer.contact}</p>
              <a href={CONTACT.mapsUrl} target="_blank" rel="noreferrer">
                <PinIcon className="nav-icon" />
                <span>
                  {CONTACT.street}
                  <br />
                  {CONTACT.city}
                </span>
              </a>
              <a href={`tel:${CONTACT.phoneE164}`}>
                <PhoneIcon className="nav-icon" />
                <span>{CONTACT.phoneDisplay}</span>
              </a>
              {/* WhatsApp lives here and not in the bar: two equal pills up there competed with
                  Reservieren, which is the one thing the header should ask for. */}
              <a href={whatsappHref} target="_blank" rel="noreferrer">
                <ArrowIcon direction="up-right" className="nav-icon" />
                <span>{t.nav.write} · WhatsApp</span>
              </a>
              <a href={CONTACT.instagram} target="_blank" rel="noreferrer">
                <InstagramIcon className="nav-icon" />
                <span>{CONTACT.instagramHandle}</span>
              </a>
            </div>
            {/* The signature, drawn large in the corner the links leave empty on a wide screen. */}
            <EmpanadaMark className="nav-art" />
          </nav>
          <div className="nav-actions">
            <LanguageSwitch variant="menu" locale={locale} path={path} label={t.nav.language} />
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
