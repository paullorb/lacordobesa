"use client";

import { useState } from "react";
import { getDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/i18n";

type Props = { locale: Locale; title: string; text: string; className?: string };

type Done = "shared" | "copied" | "failed" | null;

/**
 * Hands the page to the OS share sheet where there is one (every mobile browser), and falls back to
 * copying the link on desktop. The URL is read at click time so it also works on /karte and /gallery.
 */
export function ShareButton({ locale, title, text, className = "button secondary" }: Props) {
  const t = getDictionary(locale).share;
  const [done, setDone] = useState<Done>(null);

  async function share() {
    const url = window.location.origin + window.location.pathname;
    setDone(null);
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
        setDone("shared");
        return;
      }
      await navigator.clipboard.writeText(url);
      setDone("copied");
    } catch (error) {
      // Dismissing the share sheet rejects with AbortError, which is not a failure worth reporting.
      if (!(error instanceof DOMException && error.name === "AbortError")) setDone("failed");
    }
  }

  return (
    <>
      <button type="button" className={className} onClick={share}>
        <span aria-hidden="true">↗</span> {t.button}
      </button>
      <p className="share-note" role="status">
        {done ? t[done] : ""}
      </p>
    </>
  );
}
