"use client";

import { type ReactNode, useRef } from "react";

type Props = {
  ariaLabel: string;
  animation: "heart" | "empanada";
  className: string;
  children: ReactNode;
};

export function MotionIconButton({ ariaLabel, animation, className, children }: Props) {
  const button = useRef<HTMLButtonElement>(null);

  function animate() {
    if (!window.matchMedia("(prefers-reduced-motion: no-preference)").matches) return;
    const keyframes = animation === "heart"
      ? [{ transform: "scale(1)" }, { transform: "scale(1.35) rotate(-12deg)" }, { transform: "scale(1)" }]
      : [{ transform: "translateY(0) rotate(0)" }, { transform: "translateY(-9px) rotate(12deg) scale(1.08)" }, { transform: "translateY(0) rotate(0)" }];
    button.current?.animate(keyframes, { duration: 620, easing: "cubic-bezier(.2,.7,.2,1)" });
  }

  return <button ref={button} type="button" className={className} aria-label={ariaLabel} onClick={animate}>{children}</button>;
}
