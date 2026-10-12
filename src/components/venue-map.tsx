"use client";

import Link from "next/link";
import { useState } from "react";

type Props = { query: string; label: string; openUrl: string };

export function VenueMap({ query, label, openUrl }: Props) {
  const [loaded, setLoaded] = useState(false);
  const src = `https://www.google.com/maps?q=${encodeURIComponent(query)}&z=16&hl=de&output=embed`;

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
            Die Karte wird von Google Maps bereitgestellt. Beim Laden werden Daten (u. a. deine IP-Adresse) an Google
            übertragen – siehe <Link href="/datenschutz">Datenschutz</Link>.
          </p>
          <div className="visit-actions">
            <button type="button" className="button" onClick={() => setLoaded(true)}>
              Karte laden
            </button>
            <a className="button secondary" href={openUrl} target="_blank" rel="noreferrer">
              In Google Maps öffnen <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
