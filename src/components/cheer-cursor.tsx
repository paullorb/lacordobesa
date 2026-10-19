"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { getDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/i18n";

const noSubscribe = () => () => {};

/** A different word from the last one, so every new dish gets its own reaction. */
function nextCheer(words: readonly string[], last: string) {
  const pool = words.filter((w) => w !== last);
  return pool[Math.floor(Math.random() * pool.length)] ?? last;
}

/**
 * The round "¡Ñam!" label that rides the pointer over anything marked `data-cheer`: the dishes on the
 * landing page and the food photos in the gallery (the ones in the "food" category, see cursor_cheer).
 *
 * Mounted once per page and listening on the document, so a page only has to mark its elements. The
 * label is moved directly on the DOM rather than through state, since a pointer moves far more often
 * than React should render. It goes straight into <body>: inside the page it sat under sections that
 * GSAP's reveal leaves with a `transform`, which turns `position: fixed` into "fixed to that
 * section" and floated the label about 100px from the pointer.
 */
export function CheerCursor({ locale }: { locale: Locale }) {
  const cheers = getDictionary(locale).gallery.cheers;
  const label = useRef<HTMLSpanElement>(null);
  const hovered = useRef<Element | null>(null);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const mounted = useSyncExternalStore(noSubscribe, () => true, () => false);

  useEffect(() => {
    if (!mounted || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    const follow = (target: Element | null) => {
      const el = label.current;
      const at = pointer.current;
      if (!el) return;
      if (at) {
        // Placed without the glide when it appears, so it does not sweep in from where it last was.
        const appearing = !el.hasAttribute("data-on");
        if (appearing) el.style.transition = "none";
        el.style.translate = `${at.x}px ${at.y}px`;
        if (appearing) {
          void el.offsetWidth;
          el.style.transition = "";
        }
      }
      if (target && target !== hovered.current) el.textContent = nextCheer(cheers, el.textContent ?? "");
      hovered.current = target;
      el.toggleAttribute("data-on", !!target);
    };
    const under = (x: number, y: number) => document.elementFromPoint(x, y)?.closest("[data-cheer]") ?? null;

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      pointer.current = { x: e.clientX, y: e.clientY };
      follow((e.target as Element | null)?.closest?.("[data-cheer]") ?? null);
    };
    const onLeave = () => {
      pointer.current = null;
      follow(null);
    };
    // Scrolling moves the photos under a pointer that stays put, so the label has to ask again.
    const onScroll = () => {
      const at = pointer.current;
      if (at) follow(under(at.x, at.y));
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("scroll", onScroll);
    };
  }, [mounted, cheers]);

  // Decorative: whatever is under it already has its own accessible name.
  return mounted
    ? createPortal(
        <span className="gallery-cursor" ref={label} aria-hidden="true">
          {cheers[0]}
        </span>,
        document.body,
      )
    : null;
}
