"use client";

import Link from "next/link";
import { useState } from "react";
import { getDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/i18n";
import { legalHref } from "@/lib/legal-links";

type Props = { locale: Locale; query: string; label: string; openUrl: string };

export function VenueMap({ locale, query, label, openUrl }: Props) {
  const t = getDictionary(locale).map;
  const [loaded, setLoaded] = useState(false);
  const src = `https://www.google.com/maps?q=${encodeURIComponent(query)}&z=16&hl=${locale}&output=embed`;

  return (
    <div className="venue-map">
      {loaded ? (
        <iframe
          title={`Google Maps: ${label}`}
          src={src}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      ) : (
        <div className="venue-map-consent">
          <strong>{label}</strong>
          <p>
            {t.consentBefore}
            <Link href={legalHref("/datenschutz", locale)}>{t.privacy}</Link>
            {t.consentAfter}
          </p>
          <div className="visit-actions">
            <button type="button" className="button" onClick={() => setLoaded(true)}>
              {t.load}
            </button>
            <a className="button secondary" href={openUrl} target="_blank" rel="noreferrer">
              {t.open} <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
