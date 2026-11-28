"use client";

import { useEffect } from "react";
import { FLIP_EASE, reducedMotion } from "@/lib/motion";

/**
 * Paces the long passages of a page so they are easier to read. Renders nothing; it upgrades
 * markup the server already sent in full:
 *
 *  - `data-read="words"`: the passage is lit word by word as it crosses the reading line, so the
 *    eye is led along the sentence instead of facing a block. Driven by the scroll position, so it
 *    follows the reader's own pace in both directions, and anything already read stays lit.
 *  - `data-accordion`: the <details> inside open and close with their height eased and the answer
 *    rising into place, instead of snapping. The native element still does the opening, so
 *    find-in-page, the keyboard and a reader without script all work exactly as before.
 *
 * No library: the Web Animations API (as in src/lib/motion.ts) and one passive scroll listener.
 *
 *  - Nothing happens until the reader scrolls, so the first paint of the page (and its LCP and
 *    CLS) is the server's HTML with no work of ours in the way.
 *  - Words are split into inline spans and only their opacity changes, so no line ever moves:
 *    there is no layout shift, and a screen reader still meets one plain paragraph.
 *  - Text above the fold when this starts is never hidden, so nothing the reader is looking at
 *    blinks out and back.
 *  - `prefers-reduced-motion: reduce` gets none of it.
 */
export function ReadingMotion() {
  useEffect(() => {
    if (reducedMotion()) return;
    let cleanup = () => {};
    const start = () => {
      window.removeEventListener("scroll", start);
      if (!reducedMotion()) cleanup = enhance();
    };
    // A page opened on an anchor (#fragen) is already scrolled; otherwise wait for the first move.
    if (window.scrollY > 0) start();
    else window.addEventListener("scroll", start, { passive: true });
    return () => {
      window.removeEventListener("scroll", start);
      cleanup();
    };
  }, []);
  return null;
}

const DIM = 0.18;
const belowFold = (el: Element) => el.getBoundingClientRect().top > window.innerHeight;

function enhance() {
  const undo: Array<() => void> = [];
  for (const el of document.querySelectorAll<HTMLElement>('[data-read="words"]')) undo.push(readByWord(el));
  for (const list of document.querySelectorAll<HTMLElement>("[data-accordion]")) {
    const items = [...list.querySelectorAll<HTMLDetailsElement>(":scope > details")];
    undo.push(arriveInTurn(items.filter(belowFold)));
    for (const details of items) undo.push(accordion(details));
  }
  return () => undo.forEach((fn) => fn());
}

/** Splits a passage into word spans and lights them as it moves from 85% to 55% of the viewport. */
function readByWord(el: HTMLElement) {
  const original = [...el.childNodes].map((n) => n.cloneNode(true));
  const words: HTMLElement[] = [];
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const texts: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) texts.push(n as Text);
  for (const text of texts) {
    const parts = (text.textContent ?? "").split(/(\s+)/);
    const frag = document.createDocumentFragment();
    for (const part of parts) {
      if (!part) continue;
      if (/^\s+$/.test(part)) frag.append(part);
      else {
        const span = document.createElement("span");
        span.className = "read-word";
        span.textContent = part;
        words.push(span);
        frag.append(span);
      }
    }
    text.replaceWith(frag);
  }

  // Words already on screen when this starts stay lit: nothing the reader is looking at dims.
  const seen = words.filter((w) => w.getBoundingClientRect().top < window.innerHeight).length;
  let lit = -1;
  let frame = 0;
  const update = () => {
    frame = 0;
    const box = el.getBoundingClientRect();
    const vh = window.innerHeight;
    // 0 when the top of the passage reaches 85% of the viewport, 1 when its bottom reaches 55%.
    const from = box.top - vh * 0.85;
    const span = box.height + vh * 0.3;
    const progress = Math.min(1, Math.max(0, -from / span));
    const next = Math.max(seen, Math.round(progress * words.length));
    if (next === lit) return;
    lit = next;
    words.forEach((w, i) => (w.style.opacity = i < next ? "" : String(DIM)));
  };
  const onScroll = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };
  update();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onScroll);
    el.replaceChildren(...original);
  };
}

/** The questions below the fold arrive one after another as the list scrolls in. */
function arriveInTurn(items: HTMLElement[]) {
  if (!items.length) return () => {};
  for (const el of items) el.style.opacity = "0";
  const observer = new IntersectionObserver(
    (entries) => {
      entries
        .filter((e) => e.isIntersecting)
        .forEach((e, k) => {
          const el = e.target as HTMLElement;
          observer.unobserve(el);
          el.style.opacity = "";
          el.animate([{ opacity: 0, transform: "translateY(26px)" }, { opacity: 1, transform: "none" }], {
            duration: 800,
            delay: k * 80,
            easing: FLIP_EASE,
            fill: "backwards",
          });
        });
    },
    { rootMargin: "0px 0px -8% 0px" },
  );
  for (const el of items) observer.observe(el);
  return () => {
    observer.disconnect();
    for (const el of items) el.style.opacity = "";
  };
}

/** Eases an answer open and shut; the <details> element itself still decides what is open. */
function accordion(details: HTMLDetailsElement) {
  const summary = details.querySelector("summary");
  const answer = details.querySelector<HTMLElement>(".faq-answer");
  if (!summary || !answer) return () => {};
  let running: Animation | null = null;
  const ease = "cubic-bezier(0.645, 0.045, 0.355, 1)";

  const onClick = (event: MouseEvent) => {
    if (reducedMotion() || typeof answer.animate !== "function") return; // the native toggle, instantly
    event.preventDefault();
    running?.finish();

    if (!details.open) {
      details.open = true;
      const height = answer.scrollHeight;
      running = answer.animate([{ height: "0px", overflow: "hidden" }, { height: `${height}px`, overflow: "hidden" }], { duration: 600, easing: ease });
      answer.querySelector("p")?.animate([{ opacity: 0, transform: "translateY(14px)" }, { opacity: 1, transform: "none" }], {
        duration: 700,
        delay: 120,
        easing: FLIP_EASE,
        fill: "backwards",
      });
    } else {
      const height = answer.scrollHeight;
      running = answer.animate(
        [
          { height: `${height}px`, overflow: "hidden", opacity: 1 },
          { height: "0px", overflow: "hidden", opacity: 0 },
        ],
        { duration: 450, easing: ease, fill: "forwards" },
      );
      const closing = running;
      closing.addEventListener("finish", () => {
        details.open = false;
        closing.cancel(); // drop the held end state, so the answer is plain again next time
      });
    }
  };

  summary.addEventListener("click", onClick);
  return () => {
    summary.removeEventListener("click", onClick);
    running?.finish();
  };
}
