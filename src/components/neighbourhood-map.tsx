import type { CSSProperties } from "react";
import { LOGO } from "@/lib/brand";
import { CONTACT } from "@/lib/contact";
import { getDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/i18n";
import { ROAD_PATHS } from "./neighbourhood-map-roads";

/**
 * The streets round the shop, drawn as a map app draws them: the Niddapark with its woods,
 * meadows and allotments, the SV Blau-Gelb ground next door, the courts round the shop, the houses
 * of Ginnheim between their streets, the A66 and what lies beyond it.
 *
 * Traced from the Google Maps view of the area (about a metre a pixel, north up). The ground is a
 * static SVG (/assets/neighbourhood.svg) made by a script that places every house inside its
 * street block and clear of every road, so it costs one cached request, no third-party cookie and
 * no script. The sports grounds south of the A66 run out of the frame just as they do on the map.
 * Only the things a reader acts on are drawn here: the stops, the routes, the shop, the labels.
 *
 * The routes are links to Google Maps directions, written out in the list underneath: that list
 * is what a crawler, a keyboard and a screen reader get. The stops on the drawing link to the same
 * routes for a pointer, out of the tab order (the SVG is aria-hidden). It animates with the scroll
 * in CSS (see .hood in globals.css); with reduced motion it is simply the finished drawing.
 */

const VIEW = { x: 320, y: 100, w: 800, h: 770 };
const VENUE = { x: 632, y: 379 };
const U_STOP = { x: 990, y: 208 };
const S_STOP = { x: 775, y: 128 };
const CAR = { x: 1046, y: 700 };

/** The callout's name as drawn in the brand serif at 24px (the ink: width, and cap height since the name
 *  has no descenders), so the box round it can be the same padding on all four sides. */
const CALLOUT = { width: 149, pad: 11, ink: 18.7 };

function routeHref(origin: string, mode: "transit" | "driving", locale: Locale) {
  const q = new URLSearchParams({
    api: "1",
    origin,
    destination: `${CONTACT.name}, ${CONTACT.street}, ${CONTACT.city}`,
    travelmode: mode,
    hl: locale,
  });
  return `https://www.google.com/maps/dir/?${q}`;
}

/** The walks, along the streets you would take: from the U-Bahn west on the road past the houses,
 *  over the line and down Am Ginnheimer Wäldchen; from the S-Bahn straight down that street. */
const U_WALK = "M990 208L1012 240L944 236L874 231L806 226L762 222L733 226L722 258L710 290L695 322L681 350L668 368L654 376";
const S_WALK = "M775 128L755 132L744 170L731 210L716 254L704 290L689 322L676 348L662 366L650 374";

export function NeighbourhoodMap({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).home.neighbourhood;
  const hrefs = [
    routeHref("Hauptwache, Frankfurt am Main", "transit", locale),
    routeHref("Frankfurt (Main) Hauptbahnhof", "transit", locale),
    routeHref("Hauptwache, Frankfurt am Main", "driving", locale),
  ];
  const kinds = ["u", "s", "car"] as const;
  const box = { x: VENUE.x + 30, y: VENUE.y - 90, w: CALLOUT.width + 2 * CALLOUT.pad, h: CALLOUT.ink + 2 * CALLOUT.pad };

  return (
    <figure className="hood">
      <div className="hood-stage">
        <svg className="hood-map" viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`} aria-hidden="true" focusable="false">
          <defs>
            <filter id="hood-lift" x="-20%" y="-20%" width="140%" height="160%">
              <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#17384b" floodOpacity=".26" />
            </filter>
            {Object.entries(ROAD_PATHS).map(([id, d]) => (
              <path key={id} id={`hood-${id}-path`} d={d} />
            ))}
          </defs>

          <image className="hood-ground-art" href="/assets/neighbourhood.svg" x={VIEW.x} y={VIEW.y} width={VIEW.w} height={VIEW.h} preserveAspectRatio="none" />

          <g className="hood-road-label">
            <text dy="3.5"><textPath href="#hood-street-path" startOffset="21%">Am Ginnheimer Wäldchen</textPath></text>
            <text dy="3.5"><textPath href="#hood-street-path" startOffset="66%">Am Ginnheimer Wäldchen</textPath></text>
            <text dy="3.5"><textPath href="#hood-ginnheimer-path" startOffset="58%">Ginnheimer Straße</textPath></text>
            <text dy="3.5"><textPath href="#hood-epstein-path" startOffset="14%">Wilhelm-Epstein-Str.</textPath></text>
            <text dy="3.5"><textPath href="#hood-heinz-path" startOffset="22%">Heinzstraße</textPath></text>
            <text dy="3.5"><textPath href="#hood-landstr-path" startOffset="8%">Ginnheimer Landstraße</textPath></text>
            <text className="hood-road-label-major" dy="4"><textPath href="#hood-rosa-path" startOffset="44%">Rosa-Luxemburg-Straße</textPath></text>
            <text className="hood-road-label-major" dy="4"><textPath href="#hood-a66-path" startOffset="20%">A66</textPath></text>
            <text className="hood-road-label-major" dy="4"><textPath href="#hood-a66-path" startOffset="78%">A66</textPath></text>
          </g>

          <text className="hood-area-label" x="330" y="322">
            {t.park}
          </text>
          <text className="hood-tag hood-tag-soft" x="456" y="232" textAnchor="middle">
            {t.gardens}
          </text>
          <text className="hood-tag hood-tag-soft" x="720" y="560" textAnchor="middle">
            {t.gardens}
          </text>
          <text className="hood-label hood-label-small" x="574" y="176" textAnchor="middle">
            SV Blau-Gelb
          </text>
          <text className="hood-tag" x="578" y="366" textAnchor="end">
            {t.tennis}
          </text>
          <text className="hood-tag" x="616" y="428" textAnchor="end">
            {t.padel}
          </text>
          <text className="hood-tag hood-tag-soft" x="606" y="856" textAnchor="middle">
            TGB Frankfurt
          </text>
          <text className="hood-tag hood-tag-soft" x="815" y="856" textAnchor="middle">
            Sportcampus Ginnheim
          </text>

          {/* The park's fitness corner, the dog meadow over the motorway and the hospital. */}
          <Poi x={395} y={488} kind="sport" label={t.fitness} i={0} />
          <Poi x={640} y={760} kind="dogs" label={t.dogs} i={1} />
          <Poi x={1032} y={555} kind="health" label={["Agaplesion", "Markus Krankenhaus"]} i={2} below />

          <path className="hood-route hood-route-u" d={U_WALK} />
          <path className="hood-route hood-route-s" d={S_WALK} />

          <a href={hrefs[0]} target="_blank" rel="noreferrer" tabIndex={-1} className="hood-stop" style={{ "--i": 0 } as CSSProperties}>
            <rect x={U_STOP.x - 13} y={U_STOP.y - 13} width="26" height="26" rx="6" fill="#1a5aa6" stroke="#ffffff" strokeWidth="2.5" />
            <text x={U_STOP.x} y={U_STOP.y + 5.5} className="hood-glyph" textAnchor="middle">
              U
            </text>
            <text x={U_STOP.x - 20} y={U_STOP.y - 4} className="hood-label" textAnchor="end">
              Ginnheim Mitte
            </text>
            <text x={U_STOP.x - 20} y={U_STOP.y + 13} className="hood-tag hood-tag-u" textAnchor="end">
              U1 · U9 · 16 · {t.minutes(10)}
            </text>
          </a>
          <a href={hrefs[1]} target="_blank" rel="noreferrer" tabIndex={-1} className="hood-stop" style={{ "--i": 1 } as CSSProperties}>
            <circle cx={S_STOP.x} cy={S_STOP.y} r="14" fill="#0a8a3a" stroke="#ffffff" strokeWidth="2.5" />
            <text x={S_STOP.x} y={S_STOP.y + 5.5} className="hood-glyph" textAnchor="middle">
              S
            </text>
            <text x={S_STOP.x + 20} y={S_STOP.y - 4} className="hood-label">
              Frankfurt-Ginnheim
            </text>
            <text x={S_STOP.x + 20} y={S_STOP.y + 13} className="hood-tag hood-tag-s">
              S6 · {t.minutes(12)}
            </text>
          </a>
          <a href={hrefs[2]} target="_blank" rel="noreferrer" tabIndex={-1} className="hood-stop" style={{ "--i": 2 } as CSSProperties}>
            <rect x={CAR.x - 34} y={CAR.y - 14} width="68" height="28" rx="14" fill="#17384b" stroke="#ffffff" strokeWidth="2" />
            <path d={`M${CAR.x - 22} ${CAR.y + 6} h28 v-5 l-5 -6 h-16 l-5 6 Z M${CAR.x - 18} ${CAR.y + 7} a2.6 2.6 0 1 0 0.01 0 M${CAR.x + 2} ${CAR.y + 7} a2.6 2.6 0 1 0 0.01 0`} fill="#ffffff" />
            <path d={`M${CAR.x + 13} ${CAR.y + 1} h10 m-4 -4 l4 4 l-4 4`} fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <text x={CAR.x + 34} y={CAR.y - 37} textAnchor="end" className="hood-label hood-label-blue">
              {t.centre}
            </text>
            <text x={CAR.x + 34} y={CAR.y - 21} textAnchor="end" className="hood-tag hood-tag-car">
              {t.steps[2].line} · {t.minutes(15)}
            </text>
          </a>

          {/* La Cordobesa: the badge on a stalk over the clubhouse, the name as in the header. */}
          <a href={CONTACT.mapsUrl} target="_blank" rel="noreferrer" tabIndex={-1} className="hood-here">
            <ellipse cx={VENUE.x} cy={VENUE.y + 2} rx="12" ry="4.5" fill="#17384b" opacity=".25" />
            <circle className="hood-pulse" cx={VENUE.x} cy={VENUE.y} r="18" />
            <line x1={VENUE.x} y1={VENUE.y} x2={VENUE.x} y2={VENUE.y - 46} stroke="#17384b" strokeWidth="3" strokeLinecap="round" />
            <g className="hood-badge-mark" filter="url(#hood-lift)">
              <circle cx={VENUE.x} cy={VENUE.y - 70} r="27" fill="#ffffff" />
              <image className="hood-logo" href={LOGO.full} x={VENUE.x - 25} y={VENUE.y - 95} width="50" height="50" />
            </g>
            <g className="hood-callout">
              <rect x={box.x} y={box.y} width={box.w} height={box.h} rx="10" />
              <text x={box.x + box.w / 2} y={box.y + CALLOUT.pad + CALLOUT.ink} className="hood-brand" textAnchor="middle">
                {t.here}
              </text>
            </g>
          </a>
        </svg>
      </div>

      <figcaption className="hood-legend">
        <strong>{t.title}</strong>
        <ol>
          {t.steps.map((s, i) => (
            <li key={s.line}>
              <a href={hrefs[i]} target="_blank" rel="noreferrer">
                <span className={`hood-badge hood-badge-${kinds[i]}`}>{s.line}</span>
                <span>
                  {s.text} <span className="hood-open">{t.openRoute}</span>
                </span>
              </a>
            </li>
          ))}
        </ol>
        <small>{t.note}</small>
      </figcaption>
    </figure>
  );
}

function Poi({ x, y, kind, label, i, below }: { x: number; y: number; kind: "sport" | "health" | "dogs"; label: string | string[]; i: number; below?: boolean }) {
  const lines = Array.isArray(label) ? label : [label];
  const glyph = { fill: "none", stroke: "#ffffff", strokeWidth: 1.8, strokeLinecap: "round" as const };
  return (
    <g className={`hood-poi hood-poi-${kind}`} style={{ "--i": i } as CSSProperties}>
      <circle className="hood-poi-dot" cx={x} cy={y} r="11" />
      {kind === "sport" && <circle {...glyph} cx={x} cy={y} r="4.6" />}
      {kind === "health" && <path {...glyph} strokeWidth={2.4} d={`M${x} ${y - 5} V${y + 5} M${x - 5} ${y} H${x + 5}`} />}
      {kind === "dogs" && (
        <g fill="#ffffff">
          <ellipse cx={x} cy={y + 2.5} rx="3.4" ry="2.8" />
          <circle cx={x - 4.3} cy={y - 1.8} r="1.5" />
          <circle cx={x - 1.5} cy={y - 4.6} r="1.5" />
          <circle cx={x + 1.5} cy={y - 4.6} r="1.5" />
          <circle cx={x + 4.3} cy={y - 1.8} r="1.5" />
        </g>
      )}
      <text x={below ? x : x + 17} y={below ? y + 28 : y + 5} textAnchor={below ? "middle" : "start"} className="hood-label">
        {lines.map((line, k) => (
          <tspan key={line} x={below ? x : x + 17} dy={k ? 17 : 0}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}
