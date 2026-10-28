"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowIcon, PinIcon } from "@/components/icons";
import { getDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/i18n";
import { legalHref } from "@/lib/legal-links";

type Props = { locale: Locale; query: string; label: string; openUrl: string };
type Provider = "google" | "osm";

const OSM_EMBED_URL = "https://www.openstreetmap.org/export/embed.html?bbox=8.6265%2C50.1300%2C8.6500%2C50.1450&layer=mapnik&marker=50.1378984%2C8.6392488";
const OSM_MAP_URL = "https://www.openstreetmap.org/?mlat=50.1378984&mlon=8.6392488#map=17/50.1378984/8.6392488";

export function VenueMap({ locale, query, label, openUrl }: Props) {
  const t = getDictionary(locale).map;
  const [provider, setProvider] = useState<Provider | null>(null);
  const googleSrc = `https://www.google.com/maps?q=${encodeURIComponent(query)}&z=16&hl=${locale}&output=embed`;

  return (
    <div className="venue-map">
      {provider ? (
        <>
          <iframe
            title={`${provider === "google" ? "Google Maps" : "OpenStreetMap"}: ${label}`}
            src={provider === "google" ? googleSrc : OSM_EMBED_URL}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
          <a className="venue-map-open inline-icon" href={provider === "google" ? openUrl : OSM_MAP_URL} target="_blank" rel="noreferrer">
            {provider === "google" ? t.openGoogle : t.openOsm} <ArrowIcon direction="up-right" />
          </a>
        </>
      ) : (
        <div className="venue-map-consent">
          {/* Until a provider is chosen, show only this drawn map. Neither map provider is contacted. */}
          <span className="venue-map-pin" aria-hidden="true">
            <PinIcon size={30} />
          </span>
          <strong>{label}</strong>
          <p>
            {t.consentBefore}
            <Link href={legalHref("/datenschutz", locale)}>{t.privacy}</Link>
            {t.consentAfter}
          </p>
          <div className="visit-actions">
            <button type="button" className="button" data-track="map_load" onClick={() => setProvider("google")}>
              {t.loadGoogle}
            </button>
            <button type="button" className="button secondary" data-track="map_load" onClick={() => setProvider("osm")}>
              {t.loadOsm}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
