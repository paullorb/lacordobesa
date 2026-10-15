"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowIcon } from "@/components/icons";

type Item = { href: string; label: string };
type Group = { label: string; items: Item[] };

// Six tabs instead of twelve: pages that answer the same question share a tab, and the
// active tab's pages show as a second row.
const GROUPS: Group[] = [
  { label: "Heute", items: [{ href: "/staff", label: "Heute" }] },
  {
    label: "Gäste",
    items: [
      { href: "/staff/reservierungen", label: "Reservierungen" },
      { href: "/staff/warteliste", label: "Warteliste" },
      { href: "/staff/vorbestellungen", label: "Vorbestellungen" },
      { href: "/staff/anfragen", label: "Feier-Anfragen" },
    ],
  },
  {
    label: "Inhalte",
    items: [
      { href: "/staff/karte", label: "Karte" },
      { href: "/staff/specials", label: "Specials" },
      { href: "/staff/gallery", label: "Galerie" },
      { href: "/staff/oeffnungszeiten", label: "Öffnungszeiten" },
    ],
  },
  { label: "Verschicken", items: [{ href: "/staff/broadcast", label: "Verschicken" }] },
  {
    label: "Zahlen",
    items: [
      { href: "/staff/zahlen", label: "Zahlen" },
      { href: "/staff/besucher", label: "Besucher" },
    ],
  },
  { label: "Einstellungen", items: [{ href: "/staff/einstellungen", label: "Einstellungen" }] },
];

function isActive(pathname: string, href: string) {
  return href === "/staff" ? pathname === "/staff" : pathname.startsWith(href);
}

const pill = "whitespace-nowrap rounded-full px-3 py-1.5 font-semibold";

// Wraps on a phone rather than scrolling sideways. A scrolling tab strip hid Einstellungen and
// the Website link off the right edge with nothing on screen to say they were there, and on iOS
// there is no scrollbar to hint at it either. Two rows of pills cost less than an unreachable tab.
const row = "mx-auto flex max-w-5xl flex-wrap gap-1 px-2 pb-2 text-sm";

export function StaffNav() {
  const pathname = usePathname();
  const current = GROUPS.find((g) => g.items.some((it) => isActive(pathname, it.href)));
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
              {g.label}
            </Link>
          );
        })}
        <a
          href="/"
          target="_blank"
          rel="noreferrer"
          className={`${pill} ml-auto inline-flex items-center gap-1 text-blue-dark hover:bg-mint`}
        >
          Website <ArrowIcon direction="up-right" size={14} />
        </a>
      </nav>
      {current && current.items.length > 1 && (
        <nav aria-label={current.label} className={row}>
          {current.items.map((it) => {
            const active = isActive(pathname, it.href);
            return (
              <Link
                key={it.href}
                href={it.href}
                aria-current={active ? "page" : undefined}
                className={`${pill} border ${
                  active ? "border-ink bg-white text-ink" : "border-transparent text-muted hover:bg-mint"
                }`}
              >
                {it.label}
              </Link>
            );
          })}
        </nav>
      )}
    </>
  );
}
