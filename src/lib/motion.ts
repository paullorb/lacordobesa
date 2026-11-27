"use client";

/**
 * The site's JavaScript motion, on the Web Animations API (no dependency).
 *
 * The motion layer is CSS (see the motion block in globals.css): scroll-driven reveals, the
 * repulgue folding shut, the hero settling. This file is for the one thing CSS cannot do, which is
 * FLIP: animating an element from where it *was* to where it *is* after a reflow. That needs the
 * old and new boxes measured in JavaScript, so a list that reorders and a grid that filters would
 * otherwise teleport.
 *
 *  - `motion()` returns null when the reader asked for less movement (or on the server). Null
 *    means "change the DOM, do not animate", so the enhancement can be absent without taking a
 *    feature with it. The preference is read per interaction because it can change while the page
 *    is open.
 *  - Nothing is fetched, so there is nothing to preload and `motion()` is synchronous.
 *  - Animations leave nothing behind: no fill, so the inline style is never touched and the
 *    transform is gone the moment an animation ends. A new animation on an element cancels the one
 *    still running there.
 */

/** Whether the reader has asked their system for less movement. */
export function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** How the site moves things: one duration (seconds) and one ease, so a reorder and a refilter feel related. */
export const FLIP_DURATION = 0.45;
/** gsap's power3.out, as a cubic-bezier. */
export const FLIP_EASE = "cubic-bezier(0.215, 0.61, 0.355, 1)";

export type Pose = { x?: number; y?: number; scale?: number; opacity?: number; origin?: string };
export type TweenOptions = { duration?: number; ease?: string };

const running = new WeakMap<Element, Animation>();

function frame(p: Pose): Keyframe {
  const k: Keyframe = {};
  if (p.x !== undefined || p.y !== undefined || p.scale !== undefined) {
    k.transform = `translate(${p.x ?? 0}px, ${p.y ?? 0}px) scale(${p.scale ?? 1})`;
  }
  if (p.opacity !== undefined) k.opacity = p.opacity;
  if (p.origin) k.transformOrigin = p.origin;
  return k;
}

/** Animates `el` from one pose to another, then lets go of it. Cancels whatever it was already doing. */
function tween(el: Element, from: Pose, to: Pose, { duration = FLIP_DURATION, ease = FLIP_EASE }: TweenOptions = {}) {
  running.get(el)?.cancel();
  if (typeof el.animate !== "function") return;
  const anim = el.animate([frame(from), frame(to)], { duration: duration * 1000, easing: ease });
  running.set(el, anim);
  const done = () => running.get(el) === anim && running.delete(el);
  anim.addEventListener("finish", done);
  anim.addEventListener("cancel", done);
}

export type FlipState = { rects: Map<string | Element, DOMRect> };
export type FlipOptions = TweenOptions & {
  /** The elements to animate after the change (default: the same selector or elements as the state). */
  targets?: string | Element[];
  /** Move rows inside moving rows: each one's delta is taken relative to its moving ancestor. Translation only. */
  nested?: boolean;
  /** Skip elements that moved less than a pixel. */
  prune?: boolean;
  /** Animate the size change as well as the move (single level only). */
  scale?: boolean;
  /** Elements with no previous box (new ones), faded up in place. */
  enter?: Pose;
};

const keyOf = (el: Element) => (el as HTMLElement).dataset?.flipId ?? el;
const list = (t: string | Element[]) => (typeof t === "string" ? Array.from(document.querySelectorAll(t)) : t);

/** Records where `targets` are now, as seen on screen, and stops anything still moving so the change is measured clean. */
function getState(targets: string | Element[]): FlipState {
  const rects = new Map<string | Element, DOMRect>();
  const els = list(targets);
  for (const el of els) rects.set(keyOf(el), el.getBoundingClientRect());
  for (const el of els) running.get(el)?.cancel();
  return { rects };
}

/** Call after the DOM has changed: animates each surviving element from its old box to its new one. */
function flip(state: FlipState, targets: string | Element[], opts: FlipOptions = {}) {
  const els = list(opts.targets ?? targets);
  const deltas = new Map<Element, { x: number; y: number; s: number }>();
  const entering: Element[] = [];
  for (const el of els) {
    const before = state.rects.get(keyOf(el));
    if (!before) {
      entering.push(el);
      continue;
    }
    const after = el.getBoundingClientRect();
    const s = opts.scale && !opts.nested && after.width ? before.width / after.width : 1;
    deltas.set(el, { x: before.left - after.left, y: before.top - after.top, s });
  }
  for (const [el, d] of deltas) {
    let x = d.x;
    let y = d.y;
    if (opts.nested) {
      // The nearest moving ancestor carries this element along; only the difference is its own.
      for (let p = el.parentElement; p; p = p.parentElement) {
        const up = deltas.get(p);
        if (up) {
          x -= up.x;
          y -= up.y;
          break;
        }
      }
    }
    if (opts.prune && Math.abs(x) < 1 && Math.abs(y) < 1) continue;
    if (!opts.scale && x === 0 && y === 0) continue;
    // Top-left origin, so a size change grows from the box's corner like the move itself.
    const origin = opts.scale ? "0 0" : undefined;
    tween(el, { x, y, scale: d.s, origin }, { x: 0, y: 0, scale: 1, origin }, opts);
  }
  for (const el of entering) tween(el, opts.enter ?? { opacity: 0, scale: 0.86 }, { opacity: 1, scale: 1 }, opts);
}

export type Motion = {
  tween: typeof tween;
  getState: typeof getState;
  flip: typeof flip;
};

const api: Motion = { tween, getState, flip };

/** The motion helpers, or null where movement is not wanted: change the DOM, do not animate. */
export function motion(): Motion | null {
  if (typeof window === "undefined" || reducedMotion()) return null;
  return api;
}
