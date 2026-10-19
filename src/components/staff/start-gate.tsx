"use client";

import { type ReactNode, useEffect, useState } from "react";
import { hasStarted } from "@/lib/dates";

/** `before` until the booking's start has passed on the shop's clock, then `after`.
 *
 *  The card is server-rendered and staff leave Heute and the reservations page open for hours, so
 *  the boundary cannot be a render-time value: a card drawn at 18:00 went on offering "Stornieren"
 *  and hiding "Erledigt" long after a 19:00 booking had begun. A tick re-reads the same comparison
 *  the server made, which needs no absolute instant and so stays right across a clock change.
 *  `initiallyStarted` is the server's answer, used for the first client render too, so hydration
 *  sees one value even when the boundary falls between the two. */
export function StartGate({
  after,
  before,
  date,
  initiallyStarted,
  time,
}: {
  after: ReactNode;
  before: ReactNode;
  date: string;
  initiallyStarted: boolean;
  time: string;
}) {
  const [started, setStarted] = useState(initiallyStarted);

  useEffect(() => {
    if (started) return;
    const check = () => {
      if (hasStarted(date, time)) setStarted(true);
    };
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, [date, started, time]);

  return <>{started ? after : before}</>;
}
