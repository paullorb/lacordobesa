"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowIcon, MenuIcon, StaffIcon } from "@/components/icons";

type Item = { href: string; label: string; icon: string; adminOnly?: boolean };
type Group = { label: string; icon: string; items: Item[] };

const MENU_HREF = "/staff/karte";
/** How far the menu has to be scrolled before the Karte pill starts naming categories. */
const SCROLL_THRESHOLD = 120;

// Six tabs: pages that answer the same question share a tab, and the active tab's pages show as a
// second row. A tab with one page for the viewer has no second row. The /staff/team and
// /staff/specials routes are plain links on purpose: this file does not import them.
const GROUPS: Group[] = [
  { label: "Heute", icon: "today", items: [{ href: "/staff", label: "Heute", icon: "today" }] },
  // Everything that decides who sits where and when: bookings, the waitlist, celebrations, and the
  // opening hours that say which slots exist at all.
  {
    label: "Tische",
    icon: "guests",
    items: [
      { href: "/staff/reservierungen", label: "Reservierungen", icon: "reservations" },
      { href: "/staff/warteliste", label: "Warteliste", icon: "waitlist" },
      { href: "/staff/anfragen", label: "Feier-Anfragen", icon: "celebrate" },
      { href: "/staff/oeffnungszeiten", label: "Öffnungszeiten", icon: "hours" },
    ],
  },
  {
    label: "Bestellungen",
    icon: "preorder",
    items: [{ href: "/staff/vorbestellungen", label: "Vorbestellungen", icon: "preorder" }],
  },
  {
    label: "Website",
    icon: "content",
    items: [
      { href: MENU_HREF, label: "Karte", icon: "menu" },
      // Specials and sending them to the guests who asked for them are one page.
      { href: "/staff/specials", label: "Specials", icon: "specials" },
      { href: "/staff/gallery", label: "Galerie", icon: "gallery" },
      // The review scores on the site are the agency's business, not the restaurant's.
      { href: "/staff/bewertungen", label: "Bewertungen", icon: "reviews", adminOnly: true },
    ],
  },
  {
    label: "Zahlen",
    icon: "stats",
    items: [
      { href: "/staff/zahlen", label: "Zahlen", icon: "stats" },
      // The website's own analytics are the agency's business, not the restaurant's.
      { href: "/staff/besucher", label: "Besucher", icon: "visitors", adminOnly: true },
    ],
  },
  {
    label: "Einstellungen",
    icon: "settings",
    items: [
      { href: "/staff/einstellungen", label: "Einstellungen", icon: "settings" },
      { href: "/staff/team", label: "Team", icon: "guests", adminOnly: true },
    ],
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
      // Only once the page has actually been scrolled a little. Right after the tab opens, the pill
      // should say "Karte", not the category that happens to touch the header.
      if (window.scrollY > SCROLL_THRESHOLD) {
        // In document order, which is the menu's order, so the last one above the line is the one being read.
        for (const section of document.querySelectorAll<HTMLElement>("[data-arrange-cat]")) {
          const box = section.getBoundingClientRect();
          // A section React is still streaming in sits in a hidden container, where every box is
          // 0x0 at the top of the viewport. Counting those made the pill read "Cocktails", the
          // last category, the moment the menu opened.
          if (box.height === 0) continue;
          if (box.top > line) break;
          found = section;
        }
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
    // The menu streams in after this runs, and arriving content fires no scroll event.
    const observer = new MutationObserver(schedule);
    const main = document.getElementById("main");
    if (main) observer.observe(main, { childList: true, subtree: true });
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [enabled]);
  return enabled ? category : null;
}

const pill = "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 font-semibold";

// Wraps on a phone rather than scrolling sideways. A scrolling tab strip hid Einstellungen and
// the link to the site off the right edge with nothing on screen to say they were there, and on iOS
// there is no scrollbar to hint at it either. Two rows of pills cost less than an unreachable tab.
const row = "mx-auto flex max-w-5xl flex-wrap gap-1 px-2 pb-2 text-sm";

export function StaffNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const groups = GROUPS.map((g) => ({ ...g, items: g.items.filter((it) => isAdmin || !it.adminOnly) }));
  const current = groups.find((g) => g.items.some((it) => isActive(pathname, it.href)));
  const scrolled = useScrolledCategory(isActive(pathname, MENU_HREF));
  return (
    <>
      <nav aria-label="Bereiche" className={row}>
        {groups.map((g) => {
          const active = g === current;
          return (
            <Link
              key={g.label}
              href={g.items[0].href}
              // "page" only where the link leads to the page itself. On /staff/warteliste the Tische
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
          Seite ansehen <ArrowIcon direction="up-right" size={14} />
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
