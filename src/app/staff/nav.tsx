"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowIcon, MenuIcon, StaffIcon } from "@/components/icons";

type Item = { href: string; label: string; icon: string };
type Group = { label: string; icon: string; items: Item[] };

const MENU_HREF = "/staff/karte";

// Six tabs instead of twelve: pages that answer the same question share a tab, and the
// active tab's pages show as a second row.
const GROUPS: Group[] = [
  { label: "Heute", icon: "today", items: [{ href: "/staff", label: "Heute", icon: "today" }] },
  {
    label: "Gäste",
    icon: "guests",
    items: [
      { href: "/staff/reservierungen", label: "Reservierungen", icon: "reservations" },
      { href: "/staff/warteliste", label: "Warteliste", icon: "waitlist" },
      { href: "/staff/vorbestellungen", label: "Vorbestellungen", icon: "preorder" },
      { href: "/staff/anfragen", label: "Feier-Anfragen", icon: "celebrate" },
    ],
  },
  {
    label: "Inhalte",
    icon: "content",
    items: [
      { href: MENU_HREF, label: "Karte", icon: "menu" },
      { href: "/staff/specials", label: "Specials", icon: "specials" },
      { href: "/staff/gallery", label: "Galerie", icon: "gallery" },
      { href: "/staff/oeffnungszeiten", label: "Öffnungszeiten", icon: "hours" },
      { href: "/staff/bewertungen", label: "Bewertungen", icon: "reviews" },
    ],
  },
  { label: "Verschicken", icon: "send", items: [{ href: "/staff/broadcast", label: "Verschicken", icon: "send" }] },
  {
    label: "Zahlen",
    icon: "stats",
    items: [
      { href: "/staff/zahlen", label: "Zahlen", icon: "stats" },
      { href: "/staff/besucher", label: "Besucher", icon: "visitors" },
    ],
  },
  {
    label: "Einstellungen",
    icon: "settings",
    items: [{ href: "/staff/einstellungen", label: "Einstellungen", icon: "settings" }],
  },
];

function isActive(pathname: string, href: string) {
  return href === "/staff" ? pathname === "/staff" : pathname.startsWith(href);
}

/**
 * The menu category that has scrolled up under the header, while the menu page is open.
 *
 * The header is sticky and the menu is long, so once the "Karte" pill is the only thing on screen
 * that says where you are, it can say something better: the category you are reading. Null above
 * the first category, so the pill reads "Karte" again at the top.
 */
function useScrolledCategory(enabled: boolean) {
  const [category, setCategory] = useState<{ label: string; slug: string } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = (document.querySelector(".staff header")?.getBoundingClientRect().bottom ?? 0) + 12;
      let found: HTMLElement | null = null;
      // In document order, which is the menu's order, so the last one above the line is the one being read.
      for (const section of document.querySelectorAll<HTMLElement>("[data-arrange-cat]")) {
        if (section.getBoundingClientRect().top > line) break;
        found = section;
      }
      const next = found ? { label: found.dataset.catLabel ?? "", slug: found.dataset.catSlug ?? "" } : null;
      setCategory((prev) => (prev?.slug === next?.slug && prev?.label === next?.label ? prev : next));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(frame);
    };
  }, [enabled]);
  return enabled ? category : null;
}

const pill = "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 font-semibold";

// Wraps on a phone rather than scrolling sideways. A scrolling tab strip hid Einstellungen and
// the Website link off the right edge with nothing on screen to say they were there, and on iOS
// there is no scrollbar to hint at it either. Two rows of pills cost less than an unreachable tab.
const row = "mx-auto flex max-w-5xl flex-wrap gap-1 px-2 pb-2 text-sm";

export function StaffNav() {
  const pathname = usePathname();
  const current = GROUPS.find((g) => g.items.some((it) => isActive(pathname, it.href)));
  const scrolled = useScrolledCategory(isActive(pathname, MENU_HREF));
  return (
    <>
      <nav aria-label="Bereiche" className={row}>
        {GROUPS.map((g) => {
          const active = g === current;
          return (
            <Link
              key={g.label}
              href={g.items[0].href}
              // "page" only where the link leads to the page itself. On /staff/warteliste the Gäste
              // tab leads elsewhere, and the sub-nav's Warteliste link is the one that is the page.
              aria-current={active ? (isActive(pathname, g.items[0].href) ? "page" : "true") : undefined}
              className={`${pill} ${active ? "bg-ink text-white" : "text-ink hover:bg-mint"}`}
            >
              <StaffIcon name={g.icon} size={16} />
              {g.label}
            </Link>
          );
        })}
        <a
          href="/"
          target="_blank"
          rel="noreferrer"
          className={`${pill} ml-auto text-blue-dark hover:bg-mint`}
        >
          Website <ArrowIcon direction="up-right" size={14} />
        </a>
      </nav>
      {current && current.items.length > 1 && (
        <nav aria-label={current.label} className={row}>
          {current.items.map((it) => {
            const active = isActive(pathname, it.href);
            const category = it.href === MENU_HREF ? scrolled : null;
            return (
              <Link
                key={it.href}
                href={it.href}
                aria-current={active ? "page" : undefined}
                aria-label={category ? `${it.label}: ${category.label}` : undefined}
                className={`${pill} border ${
                  active ? "border-ink bg-white text-ink" : "border-transparent text-muted hover:bg-mint"
                }`}
              >
                {/* Keyed on the label, so the swap from "Karte" to a category replays the short fade. */}
                <span key={category?.slug ?? it.href} className={`inline-flex items-center gap-1.5 ${category ? "staff-swap" : ""}`}>
                  {category ? <MenuIcon slug={category.slug} size={16} /> : <StaffIcon name={it.icon} size={16} />}
                  <span className="max-w-[10rem] truncate">{category ? category.label : it.label}</span>
                </span>
              </Link>
            );
          })}
        </nav>
      )}
    </>
  );
}
