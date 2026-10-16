"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { localeOfPath } from "@/lib/i18n";

const LEAVE_MS = 180;
const LEAVING = "route-leaving";

/**
 * Changing page fades the old one out, then the new one fades in already at the top.
 *
 * Without this, following a link from halfway down a page showed the new page appear where the old
 * one was scrolled to and then slide up to its start, which looks like the site correcting itself.
 * Here the outgoing content is faded away first (`.route-leaving`, see globals.css), the router then
 * switches page and resets the scroll while nothing is visible, and the new page's own `page-in`
 * animation brings it up. The header stays put throughout.
 *
 * The click is intercepted with `preventDefault()` only: next/link ignores a click that is already
 * defaultPrevented, so the router push is ours, and every other handler (the open menu closing
 * itself) still runs. Anything that is not a plain left click on an internal page link is left alone.
 */
export function RouteTransition() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    document.documentElement.classList.remove(LEAVING);
  }, [pathname]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = document.documentElement;
    let push: ReturnType<typeof setTimeout> | undefined;
    let safety: ReturnType<typeof setTimeout> | undefined;

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]");
      if (!(a instanceof HTMLAnchorElement)) return;
      if ((a.target && a.target !== "_self") || a.hasAttribute("download") || a.origin !== location.origin) return;
      const url = new URL(a.href);
      // Same page (a jump to a section, a reload) and the API are not page changes. A change of
      // language swaps the whole document and has its own browser transition.
      if (url.pathname === location.pathname && url.search === location.search) return;
      if (url.pathname.startsWith("/api/") || localeOfPath(url.pathname) !== localeOfPath(location.pathname)) return;

      e.preventDefault();
      if (push) return;
      root.classList.add(LEAVING);
      push = setTimeout(() => {
        push = undefined;
        router.push(`${url.pathname}${url.search}${url.hash}`);
      }, LEAVE_MS);
      // A navigation that never lands must not leave the page blank.
      clearTimeout(safety);
      safety = setTimeout(() => root.classList.remove(LEAVING), 5000);
    };

    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      clearTimeout(push);
      clearTimeout(safety);
      root.classList.remove(LEAVING);
    };
  }, [router]);

  return null;
}
