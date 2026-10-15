"use client";

import { useEffect } from "react";

/**
 * Two things a pointer does to the page, neither of which exists on a touch screen or for a reader
 * who asked for less movement:
 *
 *  - Cards (`[data-spotlight]`) carry a soft light where the pointer is, set as `--px`/`--py` and
 *    painted by the stylesheet. It gives a flat paper card a surface without a photograph.
 *  - Buttons (`.button`, `.nav-cta`) lean a few pixels towards a pointer that is over them and
 *    settle back when it leaves, which makes a pill feel pressable before it is pressed. Done with
 *    the `translate` property so it composes with the hover lift, which uses `transform`.
 *
 * One delegated listener on the document for both, attached once by the header, which every
 * public page renders. Nothing here is required to use the page: it is the finishing layer, and
 * the stylesheet's defaults are what a reader gets if this never runs.
 */
export function PointerEffects() {
  useEffect(() => {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!fine.matches || still.matches) return;

    const MAGNET = 0.22; // how far a button follows the pointer, as a share of the pointer's offset from its centre
    let leaning: HTMLElement | null = null;

    const onMove = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (!target) return;

      const card = target.closest<HTMLElement>("[data-spotlight]");
      if (card) {
        const r = card.getBoundingClientRect();
        card.style.setProperty("--px", `${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}%`);
        card.style.setProperty("--py", `${(((e.clientY - r.top) / r.height) * 100).toFixed(1)}%`);
      }

      const button = target.closest<HTMLElement>(".button, .nav-cta");
      if (button !== leaning && leaning) {
        leaning.style.translate = "";
        leaning = null;
      }
      if (button && !button.hasAttribute("disabled")) {
        const r = button.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) * MAGNET;
        const dy = (e.clientY - (r.top + r.height / 2)) * MAGNET;
        button.style.translate = `${dx.toFixed(1)}px ${dy.toFixed(1)}px`;
        leaning = button;
      }
    };
    const onLeave = () => {
      if (leaning) {
        leaning.style.translate = "";
        leaning = null;
      }
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      onLeave();
    };
  }, []);

  return null;
}
