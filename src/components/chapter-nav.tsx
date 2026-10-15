"use client";

import { useEffect, useRef, useState } from "react";

export type Chapter = { id: string; label: string };

/**
 * The landing page's table of contents, down the right edge of a wide screen.
 *
 * Seven numbered anchors, one per section, with the section under the reader marked. It answers
 * the question a long page keeps raising, "where am I and how much is left", without a scrollbar
 * to squint at. Plain anchors, so it works before the script runs; what the script adds is the
 * mark, and keeping the whole list out of the way until the hero has been read.
 *
 * Measured on scroll rather than through an IntersectionObserver, like the carta's index: "which
 * section heading has passed the middle of the screen" is one line per frame, and seven rectangles
 * cost nothing. The stylesheet shows this only from 1321px up; a phone has the menu for this.
 */
export function ChapterNav({ label, chapters }: { label: string; chapters: Chapter[] }) {
  const nav = useRef<HTMLElement>(null);
  const [active, setActive] = useState(-1);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const sections = chapters.map((c) => document.getElementById(c.id));
    let current = -2;
    let visible: boolean | null = null;
    let frame = 0;

    const update = () => {
      frame = 0;
      const line = window.innerHeight * 0.45;
      let next = -1;
      sections.forEach((s, i) => {
        if (s && s.getBoundingClientRect().top <= line) next = i;
      });
      if (next !== current) {
        current = next;
        setActive(next);
      }
      // Hidden over the hero, which has its own cue to scroll; shown once the first chapter is reached.
      const first = sections[0];
      const show = !!first && first.getBoundingClientRect().top <= window.innerHeight * 0.8;
      if (show !== visible) {
        visible = show;
        setShown(show);
      }
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
  }, [chapters]);

  return (
    <nav className="chapter-nav" aria-label={label} ref={nav} data-shown={shown || undefined}>
      <ol>
        {chapters.map((c, i) => (
          <li key={c.id}>
            <a
              href={`#${c.id}`}
              aria-current={i === active ? "location" : undefined}
              onClick={(e) => {
                const target = document.getElementById(c.id);
                if (!target) return;
                e.preventDefault();
                target.scrollIntoView({ behavior: "smooth", block: "start" });
                history.replaceState(null, "", `#${c.id}`);
              }}
            >
              <span className="chapter-num" aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="chapter-label">{c.label}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
