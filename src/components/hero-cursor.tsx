"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { ArrowIcon } from "@/components/icons";

const noSubscribe = () => () => {};

/**
 * The hint that the page goes on, carried by the pointer instead of printed in a corner.
 *
 * Over the hero photograph the arrow becomes a small paper disc with a ↓ that keeps nudging down,
 * and a click there scrolls on to the next section. It is wherever the reader is looking, which a
 * fixed "Scrollen" in the bottom-left never was. Links and buttons get the normal pointer back,
 * because there the click means something else. Only with a fine pointer and motion allowed: on a
 * phone the thumb already knows to swipe.
 */
export function HeroCursor() {
  const disc = useRef<HTMLSpanElement>(null);
  const mounted = useSyncExternalStore(noSubscribe, () => true, () => false);

  useEffect(() => {
    const hero = document.querySelector<HTMLElement>(".hero");
    const el = disc.current;
    if (!hero || !el) return;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    if (!fine.matches) return;

    const show = (on: boolean) => {
      el.toggleAttribute("data-on", on);
      hero.toggleAttribute("data-cursor", on);
    };
    const onMove = (e: PointerEvent) => {
      const over = (e.target as Element).closest("a, button, input, select, textarea, label");
      if (!el.hasAttribute("data-on")) el.style.transition = "none";
      el.style.translate = `${e.clientX}px ${e.clientY}px`;
      if (!el.hasAttribute("data-on")) {
        void el.offsetWidth;
        el.style.transition = "";
      }
      show(!over);
    };
    const onLeave = () => show(false);
    const onClick = (e: MouseEvent) => {
      if ((e.target as Element).closest("a, button, input, select, textarea, label")) return;
      const next = hero.nextElementSibling;
      const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      next?.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });
    };
    // The hero scrolls out from under a pointer that stays put; the disc goes with it.
    const onScroll = () => {
      if (hero.getBoundingClientRect().bottom < 120) show(false);
    };
    hero.addEventListener("pointermove", onMove);
    hero.addEventListener("pointerleave", onLeave);
    hero.addEventListener("click", onClick);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      hero.removeEventListener("pointermove", onMove);
      hero.removeEventListener("pointerleave", onLeave);
      hero.removeEventListener("click", onClick);
      window.removeEventListener("scroll", onScroll);
      show(false);
    };
  }, [mounted]);

  if (!mounted) return null;
  return createPortal(
    <span ref={disc} className="hero-cursor" aria-hidden="true">
      <ArrowIcon direction="down" size={18} />
    </span>,
    document.body,
  );
}
