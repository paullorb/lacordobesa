"use client";

import { useEffect } from "react";

/**
 * Cards (`[data-spotlight]`) carry a soft light where the pointer is, set as `--px`/`--py` and
 * painted by the stylesheet. It gives a flat paper card a surface without a photograph. Not on a
 * touch screen or for a reader who asked for less movement.
 *
 * Buttons deliberately do not follow the pointer: a button that slides away from the cursor reads
 * as unsure, and the ones that matter (sending an inquiry, booking) should sit still.
 *
 * One delegated listener on the document, attached once by the header, which every public page renders.
 */
export function PointerEffects() {
  useEffect(() => {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!fine.matches || still.matches) return;

    const onMove = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (!target) return;

      const card = target.closest<HTMLElement>("[data-spotlight]");
      if (card) {
        const r = card.getBoundingClientRect();
        card.style.setProperty("--px", `${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}%`);
        card.style.setProperty("--py", `${(((e.clientY - r.top) / r.height) * 100).toFixed(1)}%`);
      }
    };
    document.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      document.removeEventListener("pointermove", onMove);
    };
  }, []);

  return null;
}
