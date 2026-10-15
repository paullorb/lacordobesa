"use client";

import { useEffect, useRef } from "react";

type Category = { slug: string; label: string };

/**
 * The sticky row of category links on the carta, with the one under the reader marked.
 *
 * Plain anchors, so the index works before JavaScript arrives and without it. What the script
 * adds is `aria-current="location"` on the category whose heading has passed the index, and
 * keeping that chip in view once the row scrolls sideways, so the reader always knows where
 * in an eleven-category card they are.
 *
 * Measured on scroll rather than through an IntersectionObserver: "which heading is above this
 * line" is a question about one line on the screen, and eleven rectangles per frame is nothing.
 */
export function MenuIndex({ label, categories }: { label: string; categories: Category[] }) {
  const nav = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = nav.current;
    if (!el) return;
    const links = Array.from(el.querySelectorAll<HTMLAnchorElement>("a[href^='#']"));
    const sections = links.map((a) => document.getElementById(decodeURIComponent(a.hash.slice(1))));
    const row = el.querySelector("ul");
    let current = -2;
    let frame = 0;

    const update = () => {
      frame = 0;
      // The reader's line: just under the index itself. The last heading above it is the category
      // being read; before the first one, nothing is marked.
      const line = el.getBoundingClientRect().bottom + 40;
      let active = -1;
      sections.forEach((s, i) => {
        if (s && s.getBoundingClientRect().top <= line) active = i;
      });
      if (active === current) return;
      current = active;
      links.forEach((a, i) => {
        if (i === active) a.setAttribute("aria-current", "location");
        else a.removeAttribute("aria-current");
      });
      const chip = links[active];
      if (!chip || !row) return;
      const left = chip.getBoundingClientRect().left - row.getBoundingClientRect().left + row.scrollLeft;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      row.scrollTo({ left: left - (row.clientWidth - chip.offsetWidth) / 2, behavior: reduced ? "auto" : "smooth" });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [categories]);

  return (
    <nav className="menu-index" aria-label={label} ref={nav}>
      <ul>
        {categories.map((c) => (
          <li key={c.slug}>
            <a href={`#${c.slug}`}>{c.label}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
