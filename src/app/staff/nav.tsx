"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
  { label: "Zahlen", items: [{ href: "/staff/zahlen", label: "Zahlen" }] },
  { label: "Einstellungen", items: [{ href: "/staff/einstellungen", label: "Einstellungen" }] },
];

function isActive(pathname: string, href: string) {
  return href === "/staff" ? pathname === "/staff" : pathname.startsWith(href);
}

const pill = "whitespace-nowrap rounded-full px-3 py-1.5 font-semibold";

export function StaffNav() {
  const pathname = usePathname();
  const current = GROUPS.find((g) => g.items.some((it) => isActive(pathname, it.href)));
  return (
    <>
      <nav aria-label="Bereiche" className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-2 pb-2 text-sm">
        {GROUPS.map((g) => {
          const active = g === current;
          return (
            <Link
              key={g.label}
              href={g.items[0].href}
              aria-current={active ? "page" : undefined}
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
          className={`${pill} ml-auto text-blue-dark hover:bg-mint`}
        >
          Website ↗
        </a>
      </nav>
      {current && current.items.length > 1 && (
        <nav aria-label={current.label} className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-2 pb-2 text-sm">
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
