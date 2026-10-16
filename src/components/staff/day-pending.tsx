"use client";

import { useLinkStatus } from "next/link";

/** Inside a calendar day's link: marks the day as chosen the moment it is clicked, while the server
 *  renders that day's reservations. Without it nothing on screen moved for the half second the
 *  round trip takes, and a second click on the same day seemed to be needed. */
export function DayPending() {
  const { pending } = useLinkStatus();
  return pending ? <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-md ring-2 ring-ink ring-inset animate-pulse" /> : null;
}
