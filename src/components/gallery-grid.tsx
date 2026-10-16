"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal, flushSync } from "react-dom";
import { track } from "@/components/analytics";
import { getDictionary } from "@/lib/dictionaries";
import { GALLERY_CATEGORIES } from "@/lib/gallery";
import type { Locale } from "@/lib/i18n";
import { FLIP_DURATION, FLIP_EASE, motion, preloadMotion } from "@/lib/motion";

const noSubscribe = () => () => {};

/** A different word from the last one, so every new photo gets its own reaction. */
function nextCheer(words: readonly string[], last: string) {
  const pool = words.filter((w) => w !== last);
  return pool[Math.floor(Math.random() * pool.length)] ?? last;
}

export type GalleryPhoto = { id: string; url: string; caption: string | null; category: string };

export function GalleryGrid({ locale, photos }: { locale: Locale; photos: GalleryPhoto[] }) {
  const t = getDictionary(locale).gallery;
  const categoryLabel = (value: string) => t.categories[value] ?? value;
  const [filter, setFilter] = useState<string>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const grid = useRef<HTMLUListElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  /** The "view" label that rides the pointer over a tile where there is a fine pointer (see
   *  .gallery-cursor). Moved directly, not through state: a pointer moves far more often than
   *  React should render. */
  const cursor = useRef<HTMLSpanElement>(null);
  /** The tile the label is over, so the word changes only when the pointer reaches another photo. */
  const hovered = useRef<Element | null>(null);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  // The label goes straight into <body>. Inside the page it sat under a section that GSAP's reveal
  // leaves with a `transform`, and a transformed ancestor turns `position: fixed` into "fixed to
  // that section": the label floated about 100px away from the pointer.
  const mounted = useSyncExternalStore(noSubscribe, () => true, () => false);
  /** The tile a reader opened the lightbox from, so the photo can grow out of it. Cleared once used,
   *  because stepping to the next photo is not an opening and must not fly in from the old tile. */
  const openedFrom = useRef<DOMRect | null>(null);

  const visible = filter === "all" ? photos : photos.filter((p) => p.category === filter);
  const index = visible.findIndex((p) => p.id === openId);
  const current = index >= 0 ? visible[index] : null;
  const present = GALLERY_CATEGORIES.filter((c) => photos.some((p) => p.category === c.value));

  // Warmed on mount rather than on the first click: a filter has to respond immediately, and a
  // chunk that is still in flight would mean the first refilter is the one that does not animate.
  useEffect(() => {
    void preloadMotion();
  }, []);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (!current) {
      if (el.open) el.close();
      return;
    }
    if (el.open) return;
    el.showModal();

    // The opening move: the photo grows out of the tile that was clicked. Only on an opening, so
    // `openedFrom` is spent here; stepping to the next photo keeps the frame where it is.
    const from = openedFrom.current;
    openedFrom.current = null;
    const m = motion();
    const box = frame.current;
    if (!m || !from || !box) return;
    const to = box.getBoundingClientRect();
    if (!to.width || !to.height) return;
    // One uniform scale, not scaleX/scaleY fitted to the tile: a tile is 4:3 and crops its photo,
    // the lightbox letterboxes it, so fitting both axes would visibly squash the picture on the
    // way in. Scaling by width alone keeps it undistorted and still reads as the tile opening.
    m.gsap.fromTo(
      box,
      {
        x: from.left + from.width / 2 - (to.left + to.width / 2),
        y: from.top + from.height / 2 - (to.top + to.height / 2),
        scale: from.width / to.width,
      },
      { x: 0, y: 0, scale: 1, duration: FLIP_DURATION, ease: FLIP_EASE, clearProps: "transform" },
    );
    const caption = el.querySelector("figcaption");
    if (caption) m.gsap.fromTo(caption, { opacity: 0 }, { opacity: 1, duration: FLIP_DURATION, ease: FLIP_EASE });
  }, [current]);

  /**
   * Refilters the grid, moving the tiles that survive from where they were to where they land.
   *
   * `auto-fill` plus `grid-auto-flow: dense` plus the 2x2 first tile means almost every tile
   * changes column, and the first one changes size, so an unanimated refilter is a hard cut that
   * loses track of every photo still on screen. FLIP is the only way to tie the two layouts
   * together: measure, let React commit, then animate the difference.
   *
   * flushSync is what makes that possible in React. The new layout has to exist in the DOM before
   * Flip can read it, and a plain setState would not have committed yet.
   */
  function refilter(value: string) {
    if (value === filter) return;
    const m = motion();
    const list = grid.current;
    if (!m || !list) {
      setFilter(value);
      return;
    }
    const state = m.Flip.getState(Array.from(list.children));
    flushSync(() => setFilter(value));
    // Read again, deliberately: `state` holds the tiles as they were, and this is the committed
    // layout, so the two lists differ by whatever left and whatever arrived.
    const arrived = Array.from(list.children);
    m.Flip.from(state, {
      duration: FLIP_DURATION,
      ease: FLIP_EASE,
      // Only the tiles still on screen are in `state`; a tile arriving from another category has
      // no previous box to fly from, so it is faded up in place instead. Tiles that left are
      // already unmounted by React and are nothing to animate.
      targets: arrived,
      onEnter: (els) =>
        m.gsap.fromTo(
          els,
          { opacity: 0, scale: 0.86 },
          { opacity: 1, scale: 1, duration: FLIP_DURATION, ease: FLIP_EASE },
        ),
    });
  }

  /** Moves the label to the pointer and shows it over a photo. Entering another photo picks a new
   *  word. Written to the DOM directly: a pointer moves far more often than React should render. */
  function follow(tile: Element | null) {
    const label = cursor.current;
    const at = pointer.current;
    if (!label) return;
    if (at) {
      // Placed without the glide when it appears, so it does not sweep in from where it last was.
      if (!label.hasAttribute("data-on")) label.style.transition = "none";
      label.style.translate = `${at.x}px ${at.y}px`;
      if (!label.hasAttribute("data-on")) {
        void label.offsetWidth;
        label.style.transition = "";
      }
    }
    if (tile && tile !== hovered.current) label.textContent = nextCheer(t.cheers, label.textContent ?? "");
    hovered.current = tile;
    label.toggleAttribute("data-on", !!tile);
  }

  // Scrolling moves the photos under a pointer that stays put, so the label has to ask again what it is over.
  useEffect(() => {
    const onScroll = () => {
      const at = pointer.current;
      if (!at) return;
      follow(document.elementFromPoint(at.x, at.y)?.closest(".gallery-grid .gallery-tile") ?? null);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  });

  function step(delta: number) {
    if (visible.length < 2) return;
    setOpenId(visible[(index + delta + visible.length) % visible.length].id);
  }

  return (
    <>
      {present.length > 1 && (
        <div className="gallery-filters" role="group" aria-label={t.filterLabel}>
          {[{ value: "all", label: t.all }, ...present.map((c) => ({ value: c.value, label: categoryLabel(c.value) }))].map((c) => (
            <button key={c.value} type="button" className="chip" aria-pressed={filter === c.value} onClick={() => refilter(c.value)}>
              {c.label}
            </button>
          ))}
        </div>
      )}

      <ul
        className="gallery-grid"
        ref={grid}
        onPointerMove={(e) => {
          pointer.current = { x: e.clientX, y: e.clientY };
          follow((e.target as Element).closest(".gallery-tile"));
        }}
        onPointerLeave={() => {
          pointer.current = null;
          follow(null);
        }}
      >
        {visible.map((p, i) => (
          // The photo's own id, so Flip pairs the two layouts by photograph rather than by whichever
          // DOM node React happened to reuse.
          <li key={p.id} data-flip-id={p.id}>
            <button
              type="button"
              className="gallery-tile"
              onClick={(e) => {
                track("gallery_open");
                openedFrom.current = e.currentTarget.getBoundingClientRect();
                setOpenId(p.id);
              }}
            >
              <Image
                src={p.url}
                alt={p.caption ?? t.photoAlt(categoryLabel(p.category))}
                fill
                sizes="(max-width: 520px) 50vw, (max-width: 900px) 33vw, 360px"
                priority={i < 2}
              />
              {p.caption && <span className="gallery-caption">{p.caption}</span>}
            </button>
          </li>
        ))}
      </ul>
      {/* Decorative: the tile is already a button whose name is the photo's caption. */}
      {mounted &&
        createPortal(
          <span className="gallery-cursor" ref={cursor} aria-hidden="true">
            {t.cheers[0]}
          </span>,
          document.body,
        )}

      <dialog
        ref={dialog}
        className="lightbox"
        aria-label={t.lightbox}
        onClose={() => setOpenId(null)}
        onClick={(e) => e.target === dialog.current && setOpenId(null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") step(1);
          if (e.key === "ArrowLeft") step(-1);
        }}
      >
        {current && (
          <figure>
            <div className="lightbox-image" ref={frame}>
              <Image src={current.url} alt={current.caption ?? categoryLabel(current.category)} fill sizes="100vw" />
            </div>
            <figcaption>
              <span>{current.caption ?? categoryLabel(current.category)}</span>
              <small>
                {index + 1} / {visible.length}
              </small>
            </figcaption>
          </figure>
        )}
        <button type="button" className="lightbox-close" aria-label={t.close} onClick={() => setOpenId(null)}>
          ×
        </button>
        {visible.length > 1 && (
          <>
            <button type="button" className="lightbox-nav prev" aria-label={t.previous} onClick={() => step(-1)}>
              ‹
            </button>
            <button type="button" className="lightbox-nav next" aria-label={t.next} onClick={() => step(1)}>
              ›
            </button>
          </>
        )}
      </dialog>
    </>
  );
}
