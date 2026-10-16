"use client";

import { type ReactNode, useEffect, useRef } from "react";

/** The ribbon of phrases under the hero. It drifts left forever; pointed at, it eases down and
 *  drifts a little the other way, and eases back to full speed when the pointer leaves. Velocity is
 *  eased in script because a CSS animation cannot change direction without jumping. Without
 *  JavaScript, or for somebody who asked for less motion, it is simply a still ribbon.
 *
 *  `children` is the track markup: two identical `.marquee-inner` copies inside `.marquee-track`. */
const SECONDS_PER_LOOP = 42;
const HOVER_FACTOR = -0.35;
const EASE_SECONDS = 0.45;

export function Marquee({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    const track = el?.querySelector<HTMLElement>(".marquee-track");
    if (!el || !track || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let offset = 0; // px the track has travelled left, wrapped to one copy
    let velocity = 1; // multiples of the base speed
    let target = 1;
    let last = 0;
    let frame = 0;
    let visible = true;

    const tick = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
      last = now;
      const loop = track.scrollWidth / 2;
      velocity += (target - velocity) * (1 - Math.exp(-dt / EASE_SECONDS));
      if (loop > 0) {
        offset = (((offset + (velocity * loop * dt) / SECONDS_PER_LOOP) % loop) + loop) % loop;
        track.style.transform = `translate3d(${-offset}px, 0, 0)`;
      }
      frame = visible ? requestAnimationFrame(tick) : 0;
    };
    const start = () => {
      if (!frame) {
        last = 0;
        frame = requestAnimationFrame(tick);
      }
    };

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
    });
    io.observe(el);
    start();

    const onEnter = (e: PointerEvent) => {
      if (e.pointerType !== "touch") target = HOVER_FACTOR;
    };
    const onLeave = () => {
      target = 1;
    };
    el.addEventListener("pointerenter", onEnter);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(frame);
      io.disconnect();
      el.removeEventListener("pointerenter", onEnter);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <div className="marquee" ref={root}>
      {children}
    </div>
  );
}
