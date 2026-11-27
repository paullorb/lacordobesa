"use client";

import { useEffect } from "react";
import { loadReading, reducedMotion } from "@/lib/motion";

/**
 * Paces the long passages of a page so they are easier to read. Renders nothing; it upgrades
 * markup the server already sent in full:
 *
 *  - `data-read="words"`: the passage is lit word by word as it crosses the reading line, so the
 *    eye is led along the sentence instead of facing a block. Scrubbed, so it follows the reader's
 *    own pace in both directions, and anything already read stays lit.
 *  - `data-accordion`: the <details> inside open and close with their height eased and the lines
 *    of the answer following, instead of snapping. The native element still does the opening, so
 *    find-in-page, the keyboard and a reader without script all work exactly as before.
 *
 * What keeps it honest:
 *
 *  - Nothing is fetched until the reader scrolls. GSAP is a lazy chunk, and the first paint of the
 *    page (and its LCP and CLS) is the server's HTML with no script of ours in the way.
 *  - Only opacity and transforms move, so no line ever changes place: there is no layout shift.
 *  - Text above the fold when GSAP lands is never hidden again, so nothing the reader is looking
 *    at blinks out and back.
 *  - `prefers-reduced-motion: reduce` gets none of it and downloads none of it.
 */
export function ReadingMotion() {
  useEffect(() => {
    if (reducedMotion()) return;
    let cancelled = false;
    let cleanup = () => {};

    const start = () => {
      window.removeEventListener("scroll", start);
      void loadReading().then((m) => {
        if (!m || cancelled || reducedMotion()) return;
        cleanup = enhance(m);
      });
    };
    // A page opened on an anchor (#fragen) is already scrolled; otherwise wait for the first move.
    if (window.scrollY > 0) start();
    else window.addEventListener("scroll", start, { passive: true });

    return () => {
      cancelled = true;
      window.removeEventListener("scroll", start);
      cleanup();
    };
  }, []);
  return null;
}

type Reading = NonNullable<Awaited<ReturnType<typeof loadReading>>>;

const belowFold = (el: Element) => el.getBoundingClientRect().top > window.innerHeight;

function enhance({ gsap, ScrollTrigger, SplitText }: Reading) {
  const undo: Array<() => void> = [];

  const ctx = gsap.context(() => {
    for (const el of document.querySelectorAll<HTMLElement>('[data-read="words"]')) {
      // Spans and no ARIA rewrite: a screen reader still meets one plain paragraph.
      const split = SplitText.create(el, { type: "words", tag: "span", wordsClass: "read-word", aria: "none" });
      undo.push(() => split.revert());
      gsap.fromTo(
        split.words,
        { opacity: 0.18 },
        {
          opacity: 1,
          ease: "none",
          stagger: 0.12,
          scrollTrigger: { trigger: el, start: "top 85%", end: "bottom 55%", scrub: 0.6 },
        },
      );
    }

    for (const list of document.querySelectorAll<HTMLElement>("[data-accordion]")) {
      // The questions arrive one after another as the list scrolls in.
      const items = [...list.querySelectorAll<HTMLDetailsElement>(":scope > details")];
      const later = items.filter(belowFold);
      if (later.length) {
        gsap.set(later, { opacity: 0, y: 26 });
        ScrollTrigger.batch(later, {
          start: "top 92%",
          once: true,
          onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 0.8, ease: "power3.out", stagger: 0.08 }),
        });
      }
      for (const details of items) undo.push(accordion(details, gsap, SplitText));
    }
  });

  // Fonts change line breaks and section heights; measure again once they are in.
  void document.fonts?.ready.then(() => ScrollTrigger.refresh());

  return () => {
    for (const fn of undo) fn();
    ctx.revert();
  };
}

function accordion(details: HTMLDetailsElement, gsap: Reading["gsap"], SplitText: Reading["SplitText"]) {
  const summary = details.querySelector("summary");
  const answer = details.querySelector<HTMLElement>(".faq-answer");
  if (!summary || !answer) return () => {};
  let busy: gsap.core.Timeline | null = null;

  const onClick = (event: MouseEvent) => {
    if (reducedMotion()) return; // the native toggle, instantly
    event.preventDefault();
    busy?.progress(1);

    if (!details.open) {
      details.open = true;
      const paragraph = answer.querySelector("p");
      const split = paragraph
        ? SplitText.create(paragraph, { type: "lines", tag: "span", mask: "lines", aria: "none" })
        : null;
      busy = gsap
        .timeline({
          onComplete: () => {
            split?.revert();
            gsap.set(answer, { clearProps: "height,overflow" });
            busy = null;
          },
        })
        .fromTo(answer, { height: 0, overflow: "hidden" }, { height: "auto", duration: 0.6, ease: "power3.inOut" })
        .from(split?.lines ?? [], { yPercent: 100, opacity: 0, duration: 0.7, ease: "power3.out", stagger: 0.06 }, 0.12);
    } else {
      busy = gsap
        .timeline({
          onComplete: () => {
            details.open = false;
            gsap.set(answer, { clearProps: "height,overflow,opacity" });
            busy = null;
          },
        })
        .to(answer, { height: 0, overflow: "hidden", opacity: 0, duration: 0.45, ease: "power3.inOut" });
    }
  };

  summary.addEventListener("click", onClick);
  return () => {
    summary.removeEventListener("click", onClick);
    busy?.progress(1);
  };
}
