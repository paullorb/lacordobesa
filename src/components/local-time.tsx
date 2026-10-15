"use client";

import { useEffect, useState } from "react";
import { getDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/i18n";

const CLOCK = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/**
 * The time on the shop's wall, ticking in the footer.
 *
 * A small thing that says the place is real and somewhere in particular: a reader in Buenos Aires
 * or Los Angeles sees what time it is in Frankfurt before deciding whether to call. Rendered empty
 * on the server and filled on the client, so the cached page never carries a stale time, and the
 * `<time>` element keeps the machine-readable value for assistive technology.
 */
export function LocalTime({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).footer;
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const update = () => setNow(new Date());
    update();
    // On the minute, so the displayed time is never a minute behind for long.
    const timer = window.setInterval(update, 15_000);
    return () => window.clearInterval(timer);
  }, []);

  if (!now) return <span className="local-time" aria-hidden="true" />;
  return (
    <span className="local-time">
      <span className="local-time-dot" aria-hidden="true" />
      <time dateTime={now.toISOString()}>{t.localTime(CLOCK.format(now))}</time>
    </span>
  );
}
