"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/staff", label: "Heute" },
  { href: "/staff/reservierungen", label: "Reservierungen" },
  { href: "/staff/warteliste", label: "Warteliste" },
  { href: "/staff/vorbestellungen", label: "Vorbestellungen" },
  { href: "/staff/anfragen", label: "Feier-Anfragen" },
  { href: "/staff/zahlen", label: "Zahlen" },
  { href: "/staff/karte", label: "Karte" },
  { href: "/staff/specials", label: "Specials" },
  { href: "/staff/gallery", label: "Galerie" },
  { href: "/staff/oeffnungszeiten", label: "Öffnungszeiten" },
  { href: "/staff/einstellungen", label: "Einstellungen" },
];

export function StaffNav() {
  const pathname = usePathname();
  return (
    <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-2 pb-2 text-sm">
      {ITEMS.map((it) => {
        const active = it.href === "/staff" ? pathname === "/staff" : pathname.startsWith(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 font-semibold ${
              active ? "bg-ink text-white" : "text-ink hover:bg-mint"
            }`}
          >
            {it.label}
          </Link>
        );
      })}
      <a
        href="/"
        target="_blank"
        rel="noreferrer"
        className="ml-auto whitespace-nowrap rounded-full px-3 py-1.5 font-semibold text-blue-dark hover:bg-mint"
      >
        Website ↗
      </a>
    </nav>
  );
}
