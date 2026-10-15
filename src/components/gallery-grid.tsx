"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { track } from "@/components/analytics";
import { getDictionary } from "@/lib/dictionaries";
import { GALLERY_CATEGORIES } from "@/lib/gallery";
import type { Locale } from "@/lib/i18n";

export type GalleryPhoto = { id: string; url: string; caption: string | null; category: string };

export function GalleryGrid({ locale, photos }: { locale: Locale; photos: GalleryPhoto[] }) {
  const t = getDictionary(locale).gallery;
  const categoryLabel = (value: string) => t.categories[value] ?? value;
  const [filter, setFilter] = useState<string>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  const visible = filter === "all" ? photos : photos.filter((p) => p.category === filter);
  const index = visible.findIndex((p) => p.id === openId);
  const current = index >= 0 ? visible[index] : null;
  const present = GALLERY_CATEGORIES.filter((c) => photos.some((p) => p.category === c.value));

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (current && !el.open) el.showModal();
    if (!current && el.open) el.close();
  }, [current]);

  function step(delta: number) {
    if (visible.length < 2) return;
    setOpenId(visible[(index + delta + visible.length) % visible.length].id);
  }

  return (
    <>
      {present.length > 1 && (
        <div className="gallery-filters" role="group" aria-label={t.filterLabel}>
          {[{ value: "all", label: t.all }, ...present.map((c) => ({ value: c.value, label: categoryLabel(c.value) }))].map((c) => (
            <button key={c.value} type="button" className="chip" aria-pressed={filter === c.value} onClick={() => setFilter(c.value)}>
              {c.label}
            </button>
          ))}
        </div>
      )}

      <ul className="gallery-grid">
        {visible.map((p, i) => (
          <li key={p.id}>
            <button type="button" className="gallery-tile" onClick={() => {
                track("gallery_open");
                setOpenId(p.id);
              }}>
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
            <div className="lightbox-image">
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
