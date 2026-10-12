"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/admin", label: "Heute" },
  { href: "/admin/reservierungen", label: "Reservierungen" },
  { href: "/admin/karte", label: "Karte" },
  { href: "/admin/specials", label: "Specials" },
  { href: "/admin/oeffnungszeiten", label: "Öffnungszeiten" },
  { href: "/admin/einstellungen", label: "Einstellungen" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-2 pb-2 text-sm">
      {ITEMS.map((it) => {
        const active = it.href === "/admin" ? pathname === "/admin" : pathname.startsWith(it.href);
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
    </nav>
  );
}
