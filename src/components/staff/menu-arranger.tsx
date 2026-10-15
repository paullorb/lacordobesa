"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { flushSync } from "react-dom";
import { arrangeCategories, arrangeMenuItems, setMenuItemFeatured, type ActionResult } from "@/app/staff/actions";
import { FLIP_EASE, motion, preloadMotion } from "@/lib/motion";

export type ArrangerCategory = {
  id: string;
  slug: string;
  label: string;
  /** The category's heading and edit form, rendered on the server. */
  header: React.ReactNode;
  /** The "+ Gericht" form under the list. */
  footer: React.ReactNode;
};

export type ArrangerItem = {
  id: string;
  categoryId: string;
  name: string;
  featured: boolean;
  available: boolean;
  /** The dish's row with its edit form, rendered on the server. */
  row: React.ReactNode;
};

type Layout = { cats: string[]; items: Record<string, string[]>; featured: string[] };

type Drag =
  | { kind: "item"; id: string; pointerId: number }
  | { kind: "cat"; id: string; pointerId: number }
  | { kind: "featured"; id: string; pointerId: number };

function layoutOf(categories: ArrangerCategory[], items: ArrangerItem[]): Layout {
  const byCat: Record<string, string[]> = Object.fromEntries(categories.map((c) => [c.id, []]));
  for (const i of items) byCat[i.categoryId]?.push(i.id);
  // The home page shows featured dishes in menu order, so the Startseite list does too.
  const featured = categories.flatMap((c) => byCat[c.id].filter((id) => items.find((i) => i.id === id)?.featured));
  return { cats: categories.map((c) => c.id), items: byCat, featured };
}

const without = (list: string[], id: string) => list.filter((x) => x !== id);
const insertAt = (list: string[], id: string, index: number) => [...list.slice(0, index), id, ...list.slice(index)];

/** Everything on the page that a reorder can move: a dish row, a category section, a Startseite chip. */
const MOVABLE = "[data-arrange-item], [data-arrange-cat], [data-arrange-chip]";
/** A drag has to keep up with the finger, so its glide is short. A keypress can afford the full one. */
const DRAG_GLIDE = 0.22;
const KEY_GLIDE = 0.4;

/**
 * The staff menu as staff see it on the site, rearranged by dragging.
 *
 * Every dish and every category has a handle. Dragging reorders the list live, across categories
 * too, and drops write the new order back. Dropping a dish on "Startseite" puts it on the home page;
 * dragging it out of there (or its ×) takes it off again. Pointer events rather than the HTML drag
 * API, because the staff area mostly runs on phones and Chrome on Android never fires HTML drag
 * events for touch. The handles also take ↑/↓ from the keyboard.
 *
 * Remounted by the page (`key`) whenever the server's order changes, so after a save the state is
 * whatever the database says, not what this component guessed.
 */
export function MenuArranger({ categories, items }: { categories: ArrangerCategory[]; items: ArrangerItem[] }) {
  const [layout, setLayout] = useState(() => layoutOf(categories, items));
  const [drag, setDrag] = useState<Drag | null>(null);
  const [overFeatured, setOverFeatured] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const featuredZone = useRef<HTMLDivElement>(null);
  const pointerY = useRef(0);

  // Warmed on mount: a reorder is a finger drag or a keypress, and neither can wait for a chunk to
  // arrive over the network, so by the time a handle is grabbed Flip is already here.
  useEffect(() => {
    void preloadMotion();
  }, []);

  /**
   * Changes the layout, gliding every row from where it was to where it lands.
   *
   * Without this a reorder is a teleport. On a keypress that is actively confusing: ↓ on a handle
   * silently rearranges the list and nothing says which row moved or how far, which is the one
   * cue a keyboard user has no pointer to supply. Dragging has the same problem more mildly, as
   * the rows a dish displaces jump around it.
   *
   * flushSync is the point: Flip has to read the new layout out of the DOM, so the commit cannot
   * wait for React to get round to it.
   */
  function relayout(next: React.SetStateAction<Layout>, duration: number) {
    // `move` runs on every pointermove and most of them land the dish exactly where it already is;
    // its updaters return the layout they were given, unchanged, when that happens. Spotting that
    // by identity keeps a measurement of every row in the menu out of the common case, which is
    // the difference between a drag that tracks the finger on a phone and one that does not.
    const resolved = typeof next === "function" ? next(layout) : next;
    if (resolved === layout) return;
    const m = motion();
    if (!m) {
      setLayout(resolved);
      return;
    }
    // A selector rather than a ref into this subtree: the page renders one arranger, these three
    // attributes belong to it alone, and reading a ref here would be a render-time ref access
    // (the window handlers below are captured into a useRef on every render).
    const state = m.Flip.getState(MOVABLE);
    flushSync(() => setLayout(resolved));
    // nested, because the dish rows live inside the category sections and both can move at once.
    // prune, so a one-step swap on a sixty-dish menu animates the two rows that changed places.
    m.Flip.from(state, {
      duration,
      ease: FLIP_EASE,
      nested: true,
      prune: true,
      // `targets` so a row or chip that did not exist a moment ago is animated too, not just the
      // ones that moved. The one that matters is the Startseite chip: dropping a dish on the home
      // page has no other confirmation, and a chip that scales up says the drop was taken.
      targets: MOVABLE,
      onEnter: (els) =>
        m.gsap.fromTo(els, { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1, duration, ease: FLIP_EASE }),
    });
  }

  const itemById = new Map(items.map((i) => [i.id, i]));
  const catById = new Map(categories.map((c) => [c.id, c]));
  const catOf = (l: Layout, id: string) => l.cats.find((c) => l.items[c].includes(id));

  function save(run: () => Promise<ActionResult>) {
    setError(null);
    startTransition(async () => {
      // A dropped connection throws rather than returning an error; both put the order back.
      const result = await run().catch((): ActionResult => ({ ok: false, error: "Keine Verbindung." }));
      if (result && !result.ok) {
        setError(`Nicht gespeichert: ${result.error}`);
        // The rows glide back to where they were, so a rejected save is visible as a movement and
        // not only as a sentence above the list.
        relayout(layoutOf(categories, items), KEY_GLIDE);
      }
    });
  }

  // Scroll while a drag holds near the top or bottom edge, so a dish can travel down a long menu.
  useEffect(() => {
    if (!drag) return;
    let frame = requestAnimationFrame(function tick() {
      const y = pointerY.current;
      const edge = 70;
      if (y < edge) window.scrollBy(0, -Math.ceil((edge - y) / 5));
      else if (y > window.innerHeight - edge) window.scrollBy(0, Math.ceil((y - (window.innerHeight - edge)) / 5));
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [drag]);

  // Move and drop are heard on the window, not the handle: a dish moved into another category is
  // a new element there, and the old handle (with any pointer capture) is gone mid-drag.
  const handlers = useRef({ move, end, cancel });
  useEffect(() => {
    handlers.current = { move, end, cancel };
  });
  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => handlers.current.move(e);
    const onEnd = (e: PointerEvent) => handlers.current.end(e);
    const onCancel = (e: PointerEvent) => handlers.current.cancel(e);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onCancel);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onCancel);
    };
  }, [drag]);

  function start(e: React.PointerEvent, next: Drag) {
    if (pending || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.preventDefault();
    window.getSelection()?.removeAllRanges();
    pointerY.current = e.clientY;
    // A featured dish's handle sits inside Startseite, so the drop state starts there: a tap with
    // no pointermove must not read as a drag out of the zone and take the dish off the home page.
    setOverFeatured(next.kind === "featured");
    setDrag(next);
  }

  function move(e: PointerEvent) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    pointerY.current = e.clientY;
    const zone = featuredZone.current?.getBoundingClientRect();
    const inFeatured = !!zone && e.clientY >= zone.top && e.clientY <= zone.bottom && e.clientX >= zone.left && e.clientX <= zone.right;
    setOverFeatured(inFeatured);
    if (drag.kind === "featured" || inFeatured) return;

    const under = document.elementFromPoint(e.clientX, e.clientY);
    if (drag.kind === "cat") {
      const target = under?.closest<HTMLElement>("[data-arrange-cat]")?.dataset.arrangeCat;
      if (!target || target === drag.id) return;
      const rect = under!.closest("[data-arrange-cat]")!.getBoundingClientRect();
      relayout((l) => {
        const rest = without(l.cats, drag.id);
        const at = rest.indexOf(target) + (e.clientY > rect.top + rect.height / 2 ? 1 : 0);
        return { ...l, cats: insertAt(rest, drag.id, at) };
      }, DRAG_GLIDE);
      return;
    }

    // A dish: over another dish, go before or after it; over a category with no dish under the
    // pointer (its heading, an empty list), go to the end of that category.
    const row = under?.closest<HTMLElement>("[data-arrange-item]");
    const targetItem = row?.dataset.arrangeItem;
    if (targetItem === drag.id) return;
    const targetCat = under?.closest<HTMLElement>("[data-arrange-cat]")?.dataset.arrangeCat;
    if (!targetCat) return;
    relayout((l) => {
      const from = catOf(l, drag.id);
      if (!from) return l;
      const items = { ...l.items, [from]: without(l.items[from], drag.id) };
      let at = items[targetCat].length;
      if (targetItem && row) {
        const rect = row.getBoundingClientRect();
        at = items[targetCat].indexOf(targetItem) + (e.clientY > rect.top + rect.height / 2 ? 1 : 0);
      }
      if (from === targetCat && l.items[from].indexOf(drag.id) === at) return l;
      items[targetCat] = insertAt(items[targetCat], drag.id, at);
      return { ...l, items };
    }, DRAG_GLIDE);
  }

  function end(e: PointerEvent) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const d = drag;
    const dropFeatured = overFeatured;
    setDrag(null);
    setOverFeatured(false);

    if (d.kind === "featured") {
      if (!dropFeatured) unfeature(d.id);
      return;
    }
    if (d.kind === "cat") {
      const before = categories.map((c) => c.id);
      if (layout.cats.join() !== before.join()) save(() => arrangeCategories(layout.cats));
      return;
    }
    if (dropFeatured) {
      // Dropped on Startseite: the dish goes back where it came from, and onto the home page.
      const original = layoutOf(categories, items);
      if (layout.featured.includes(d.id)) setLayout(original);
      else feature(d.id, original);
      return;
    }
    const to = catOf(layout, d.id);
    const original = layoutOf(categories, items);
    if (to && layout.items[to].join() !== original.items[to].join()) save(() => arrangeMenuItems(to, layout.items[to]));
  }

  // pointercancel (a touch interrupted, the pointer lost) is not a drop: put everything back and save nothing.
  function cancel(e: PointerEvent) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    setDrag(null);
    setOverFeatured(false);
    relayout(layoutOf(categories, items), KEY_GLIDE);
  }

  function feature(id: string, base: Layout = layout) {
    const inOrder = base.cats.flatMap((c) => base.items[c]).filter((x) => x === id || base.featured.includes(x));
    relayout({ ...base, featured: inOrder }, KEY_GLIDE);
    save(() => setMenuItemFeatured(id, true));
  }

  function unfeature(id: string) {
    relayout((l) => ({ ...l, featured: without(l.featured, id) }), KEY_GLIDE);
    save(() => setMenuItemFeatured(id, false));
  }

  // ↑/↓ on a handle: one step, across category boundaries for dishes.
  function keyItem(e: React.KeyboardEvent, id: string) {
    const step = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
    if (!step || pending) return;
    e.preventDefault();
    const from = catOf(layout, id);
    if (!from) return;
    const list = without(layout.items[from], id);
    const index = layout.items[from].indexOf(id) + step;
    let to = from;
    let at = index;
    if (index < 0 || index > list.length) {
      const ci = layout.cats.indexOf(from) + step;
      if (ci < 0 || ci >= layout.cats.length) return;
      to = layout.cats[ci];
      at = step < 0 ? layout.items[to].length : 0;
    }
    const next = { ...layout.items, [from]: list };
    next[to] = insertAt(to === from ? list : layout.items[to], id, at);
    relayout({ ...layout, items: next }, KEY_GLIDE);
    save(() => arrangeMenuItems(to, next[to]));
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-handle="${id}"]`)?.focus());
  }

  function keyCat(e: React.KeyboardEvent, id: string) {
    const step = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
    if (!step || pending) return;
    e.preventDefault();
    const index = layout.cats.indexOf(id) + step;
    if (index < 0 || index >= layout.cats.length) return;
    const cats = insertAt(without(layout.cats, id), id, index);
    relayout({ ...layout, cats }, KEY_GLIDE);
    save(() => arrangeCategories(cats));
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-handle="${id}"]`)?.focus());
  }

  const handleProps = (id: string, label: string) => ({
    type: "button" as const,
    "data-handle": id,
    "aria-label": `${label} verschieben (Pfeiltasten hoch und runter)`,
    title: "Ziehen zum Verschieben",
    // touch-none: without it the browser takes a finger drag on the handle as a page scroll.
    // min-h/min-w: this is the one control on the page that has to be grabbed accurately, and it
    // was 23x32, under the 24px WCAG 2.2 floor in one direction and well under a thumb in both.
    className:
      "flex min-h-10 min-w-9 shrink-0 cursor-grab touch-none select-none items-center justify-center rounded leading-none text-muted hover:bg-cream hover:text-ink active:cursor-grabbing",
  });

  return (
    <div className={`grid gap-6 ${drag ? "select-none" : ""}`} aria-busy={pending}>
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <section
        ref={featuredZone}
        className={`grid gap-2 rounded-md border-2 border-dashed p-3 transition-colors ${
          overFeatured && drag?.kind === "item" ? "border-blue bg-sky-50" : "border-line bg-mint/40"
        }`}
        aria-labelledby="startseite-title"
      >
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h2 id="startseite-title" className="font-serif text-xl">
            Startseite
          </h2>
          <span className="text-xs text-muted">Gericht hierher ziehen, um es oben auf der Website zu zeigen.</span>
        </div>
        {layout.featured.length === 0 ? (
          <p className="text-sm text-muted">Noch nichts ausgewählt: die Website zeigt dann das erste Gericht jeder Kategorie.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {layout.featured.map((id) => {
              const item = itemById.get(id);
              if (!item) return null;
              return (
                <li
                  key={id}
                  data-arrange-chip={id}
                  data-flip-id={`chip-${id}`}
                  className={`flex min-h-10 items-center gap-1 rounded-full border border-line bg-white py-0.5 pr-1 text-sm ${
                    drag?.id === id ? "opacity-50" : ""
                  } ${item.available ? "" : "text-muted line-through"}`}
                >
                  <button
                    {...handleProps(id, item.name)}
                    aria-label={`${item.name} von der Startseite nehmen: herausziehen`}
                    onPointerDown={(e) => start(e, { kind: "featured", id, pointerId: e.pointerId })}
                  >
                    ⠿
                  </button>
                  {item.name}
                  <button
                    type="button"
                    className="flex h-7 w-7 items-center justify-center rounded-full text-muted hover:bg-cream hover:text-ink"
                    aria-label={`${item.name} von der Startseite nehmen`}
                    onClick={() => unfeature(id)}
                    disabled={pending}
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {layout.cats.map((catId) => {
        const cat = catById.get(catId);
        if (!cat) return null;
        const list = layout.items[catId];
        return (
          <section
            key={catId}
            id={`cat-${cat.slug}`}
            data-arrange-cat={catId}
            data-flip-id={`cat-${catId}`}
            className={`grid gap-2 scroll-mt-28 ${drag?.id === catId ? "rounded-md opacity-60 ring-2 ring-blue" : ""}`}
          >
            <div className="flex items-start gap-2">
              <button {...handleProps(catId, `Kategorie ${cat.label}`)} onPointerDown={(e) => start(e, { kind: "cat", id: catId, pointerId: e.pointerId })} onKeyDown={(e) => keyCat(e, catId)}>
                ⠿
              </button>
              <div className="min-w-0 flex-1">{cat.header}</div>
            </div>

            <div className="grid min-h-10 gap-1.5">
              {list.length === 0 && (
                <p className="rounded-md border border-dashed border-line px-3 py-2 text-sm text-muted">
                  Noch keine Gerichte. Hierher ziehen, um eins zu verschieben.
                </p>
              )}
              {list.map((id) => {
                const item = itemById.get(id);
                if (!item) return null;
                return (
                  <div
                    key={id}
                    // The dish's own id, so a row dragged into another category is still the same
                    // row to Flip and glides across, even though React has remounted it there.
                    data-arrange-item={id}
                    data-flip-id={`row-${id}`}
                    className={`flex items-start gap-2 ${drag?.id === id && drag.kind === "item" ? "rounded-md opacity-60 ring-2 ring-blue" : ""}`}
                  >
                    <button
                      {...handleProps(id, item.name)}
                      onPointerDown={(e) => start(e, { kind: "item", id, pointerId: e.pointerId })}
                      onKeyDown={(e) => keyItem(e, id)}
                    >
                      ⠿
                    </button>
                    <div className="min-w-0 flex-1">{item.row}</div>
                  </div>
                );
              })}
            </div>
            {cat.footer}
          </section>
        );
      })}
    </div>
  );
}
