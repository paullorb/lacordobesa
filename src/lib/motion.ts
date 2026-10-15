"use client";

/**
 * GSAP's Flip plugin, loaded off the critical path.
 *
 * The site's motion layer is CSS (see the motion block in globals.css): scroll-driven reveals, the
 * repulgue folding shut, the hero settling. None of that needs JavaScript and none of it is here.
 * GSAP is loaded for the one thing CSS cannot do at all, which is FLIP: animating an element from
 * where it *was* to where it *is* after a reflow. That needs the old and new boxes measured in
 * JavaScript, so there is no stylesheet that can express it, and without it a list that reorders
 * and a grid that filters simply teleport.
 *
 * Three rules hold it to its weight:
 *
 *  - It is `import()`ed, never imported statically, so it is a lazy chunk rather than part of the
 *    first load. `/` ships no GSAP at all, which is what keeps the JavaScript budget in
 *    tests/e2e/perf.test.mjs honest.
 *  - It is fetched when a component that can use it mounts, not when it is first needed. A click
 *    cannot wait for a network round trip, so by the time anyone filters or drags, it has arrived.
 *  - If it has *not* arrived, or the reader asked for less movement, `flip()` returns null and the
 *    caller changes the DOM without animating. That is exactly today's behaviour, so the
 *    enhancement can fail without taking a feature with it.
 */

import type { gsap as GSAP } from "gsap";
import type { Flip as FlipPlugin } from "gsap/Flip";

type Motion = { gsap: typeof GSAP; Flip: typeof FlipPlugin };

let loaded: Motion | null = null;
let loading: Promise<void> | null = null;

/** Whether the reader has asked their system for less movement. */
export function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Starts fetching GSAP, once per page. Safe to call on every mount.
 *
 * Deliberately not awaited by callers: it warms the chunk, and `motion()` below is what decides
 * whether an individual interaction animates.
 */
export function preloadMotion(): Promise<void> {
  if (typeof window === "undefined" || reducedMotion()) return Promise.resolve();
  // A failed chunk fetch must not reject into a component or log a crash: motion is optional, so
  // `loaded` simply stays null and every later interaction is instant.
  loading ??= (async () => {
    const [{ gsap }, { Flip }] = await Promise.all([import("gsap"), import("gsap/Flip")]);
    gsap.registerPlugin(Flip);
    loaded = { gsap, Flip };
  })().catch(() => {});
  return loading;
}

/**
 * GSAP, if it is ready and movement is wanted. Null means "change the DOM, do not animate".
 *
 * The preference is read per interaction rather than once at mount, because it can change while
 * the page is open. Turning it on takes effect immediately. Turning it *off* cannot, since the
 * chunk was never fetched: that interaction is instant and the fetch it starts here means the
 * next one moves.
 */
export function motion(): Motion | null {
  if (reducedMotion()) return null;
  if (!loaded) void preloadMotion();
  return loaded;
}

/** How the site moves things: one duration and one ease, so a reorder and a refilter feel related. */
export const FLIP_DURATION = 0.45;
export const FLIP_EASE = "power3.out";
