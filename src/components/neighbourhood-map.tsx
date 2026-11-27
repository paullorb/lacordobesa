import type { CSSProperties } from "react";
import { LOGO } from "@/lib/brand";
import { CONTACT } from "@/lib/contact";
import { getDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/i18n";

/**
 * The few streets round the shop, drawn in the colours people know from a map app: the Niddapark
 * and the allotments in green, the SV Blau-Gelb ground with its track and pitches next door, the
 * tennis and padel courts the shop sits among, the U-Bahn and S-Bahn stops, the A66 and
 * Rosa-Luxemburg-Straße as the yellow roads that frame it.
 *
 * Drawn by hand from the map view of the area (roughly to scale, north up) rather than embedded,
 * so it costs no request, no third-party cookie and no script, and it is in the brand's colours.
 * The coordinates are those of that view (1300 × 830); the viewBox crops the part that matters.
 * Every road runs on to the edge of the drawing or into another road, as it does on the ground.
 *
 * The routes are links to Google Maps directions, written out in the list underneath: that list
 * is what a crawler, a keyboard and a screen reader get. The stops on the drawing link to the same
 * routes for a pointer, out of the tab order (the SVG is aria-hidden). It animates with the scroll
 * in CSS (see .hood in globals.css); with reduced motion it is simply the finished drawing.
 */

const VENUE = { x: 625, y: 378 };
const U_STOP = { x: 990, y: 208 };
const S_STOP = { x: 788, y: 150 };

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

const ROADS = {
  street: "M800 -10 C 745 210, 650 430, 558 840",
  rail: "M828 -10 C 784 200, 692 430, 590 840",
  rosa: "M780 -10 C 812 60, 846 92, 900 118 C 970 150, 1050 168, 1130 182",
  a66: "M310 604 C 620 646, 860 712, 1130 762",
  landstrasse: "M562 736 C 760 748, 900 770, 952 728 C 962 600, 954 360, 948 120",
  epstein: "M952 470 C 1030 478, 1090 498, 1130 510",
  grid: "M804 152 L 812 470 M808 318 L 950 338 M812 448 L 952 458 M950 236 L 1130 268 M1104 262 L 1112 506 M812 470 C 860 520, 900 600, 960 640 M952 728 C 1010 760, 1070 780, 1130 790",
};

export function NeighbourhoodMap({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).home.neighbourhood;
  const hrefs = [
    routeHref("Hauptwache, Frankfurt am Main", "transit", locale),
    routeHref("Frankfurt (Main) Hauptbahnhof", "transit", locale),
    routeHref("Hauptwache, Frankfurt am Main", "driving", locale),
  ];
  const kinds = ["u", "s", "car"] as const;

  const uWalk = `M${U_STOP.x} ${U_STOP.y} C 930 196, 862 170, 800 156 C 770 222, 720 300, ${VENUE.x + 20} ${VENUE.y - 8}`;
  const sWalk = `M${S_STOP.x} ${S_STOP.y} C 772 222, 724 300, ${VENUE.x + 14} ${VENUE.y - 12}`;

  return (
    <figure className="hood">
      <div className="hood-stage">
        <svg className="hood-map" viewBox="320 40 800 760" aria-hidden="true" focusable="false">
          <defs>
            {/* Houses as little blocks with a lit roof and a shadowed side: the town east of the rails. */}
            <pattern id="hood-blocks" width="36" height="28" patternUnits="userSpaceOnUse" patternTransform="rotate(8)">
              <rect x="5" y="6" width="24" height="15" rx="2" fill="#d6cdbf" />
              <rect x="3" y="3" width="24" height="15" rx="2" fill="#efe9df" />
              <rect x="3" y="3" width="24" height="5" rx="2" fill="#f8f4ee" />
            </pattern>
            <pattern id="hood-plots" width="18" height="18" patternUnits="userSpaceOnUse" patternTransform="rotate(-14)">
              <rect width="18" height="18" fill="#cbe5b9" />
              <rect x="1.5" y="1.5" width="15" height="15" rx="2" fill="#b9dba3" />
              <circle cx="12" cy="6" r="2.6" fill="#9cc987" />
            </pattern>
            <radialGradient id="hood-tree" cx=".38" cy=".34" r=".7">
              <stop offset="0" stopColor="#b6dc9d" />
              <stop offset=".6" stopColor="#7fb86a" />
              <stop offset="1" stopColor="#5f9a52" />
            </radialGradient>
            <pattern id="hood-trees" width="26" height="24" patternUnits="userSpaceOnUse">
              <ellipse cx="9" cy="12" rx="6.5" ry="4" fill="#5d8f4f" opacity=".35" />
              <circle cx="7" cy="8" r="6" fill="url(#hood-tree)" />
              <ellipse cx="21" cy="21" rx="5" ry="3" fill="#5d8f4f" opacity=".35" />
              <circle cx="19" cy="18" r="4.6" fill="url(#hood-tree)" />
            </pattern>
            <pattern id="hood-grass" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(20)">
              <rect width="12" height="12" fill="#c6e5ae" />
              <path d="M0 6 H12" stroke="#bddda4" strokeWidth="2" />
            </pattern>
            <linearGradient id="hood-light" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ffffff" stopOpacity=".28" />
              <stop offset=".55" stopColor="#ffffff" stopOpacity="0" />
              <stop offset="1" stopColor="#17384b" stopOpacity=".12" />
            </linearGradient>
            <filter id="hood-lift" x="-20%" y="-20%" width="140%" height="160%">
              <feDropShadow dx="0" dy="5" stdDeviation="4" floodColor="#17384b" floodOpacity=".28" />
            </filter>
            <path id="hood-street-path" d={ROADS.street} />
            <path id="hood-a66-path" d={ROADS.a66} />
            <path id="hood-rl-path" d={ROADS.rosa} />
          </defs>

          {/* Land, then the town east of the railway. */}
          <rect x="320" y="0" width="800" height="830" fill="#f3efe6" />
          <path d="M790 120 L 1130 110 L 1130 830 L 980 830 L 962 700 L 640 760 L 700 470 Z" fill="url(#hood-blocks)" />

          {/* The Niddapark, its woods and the allotments between it and the courts. */}
          <g className="hood-green">
            <path d="M320 0 L 776 0 L 742 140 L 610 150 L 560 122 L 430 118 L 404 260 L 458 384 L 560 410 L 604 436 L 580 560 L 556 650 L 540 700 L 320 660 Z" fill="url(#hood-grass)" />
            <path d="M330 300 C 380 270, 420 330, 400 420 C 380 500, 340 520, 320 470 Z" fill="url(#hood-trees)" />
            <path d="M470 440 C 520 430, 560 470, 540 560 C 520 620, 470 600, 460 540 Z" fill="url(#hood-trees)" />
            <path d="M330 40 C 390 20, 440 60, 420 110 C 400 150, 350 140, 330 110 Z" fill="url(#hood-trees)" />
            <path d="M600 24 C 650 10, 700 30, 700 70 C 690 110, 630 110, 610 80 Z" fill="url(#hood-trees)" />
            <path d="M420 128 L 556 132 L 520 300 L 545 404 L 458 380 L 408 262 Z" fill="url(#hood-plots)" />
            <path d="M650 470 L 940 476 L 946 700 L 610 712 L 620 560 Z" fill="url(#hood-plots)" />
            <path d="M330 220 C 400 180, 450 220, 470 300 S 540 420, 600 430 M360 560 C 420 520, 480 500, 556 420 M400 100 C 470 140, 500 120, 560 128 M330 640 C 380 600, 420 620, 470 600" fill="none" stroke="#f7f3ea" strokeWidth="3" strokeLinecap="round" />
          </g>

          {/* Roads, each drawn twice (casing, then surface) so they read as raised above the ground. */}
          <g className="hood-roads" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d={`${ROADS.grid} ${ROADS.epstein} ${ROADS.landstrasse}`} stroke="#d8cfc0" strokeWidth="10" />
            <path d={`${ROADS.grid} ${ROADS.epstein} ${ROADS.landstrasse}`} stroke="#ffffff" strokeWidth="7" />
            <path d={ROADS.street} stroke="#d8cfc0" strokeWidth="14" />
            <path d={ROADS.street} stroke="#ffffff" strokeWidth="10" />
            <path d={ROADS.rail} stroke="#8c969c" strokeWidth="6" />
            <path d={ROADS.rail} stroke="#f3efe6" strokeWidth="2.2" strokeDasharray="9 9" />
            <g filter="url(#hood-lift)">
              <path d={`${ROADS.rosa} ${ROADS.a66}`} stroke="#dcae45" strokeWidth="24" />
              <path d={`${ROADS.rosa} ${ROADS.a66}`} stroke="#f7d57a" strokeWidth="18" />
              <path d={`${ROADS.rosa} ${ROADS.a66}`} stroke="#fbe6a8" strokeWidth="1.4" strokeDasharray="12 10" />
            </g>
          </g>
          <g className="hood-road-label">
            <text dy="4"><textPath href="#hood-street-path" startOffset="20%">Am Ginnheimer Wäldchen</textPath></text>
            <text dy="4"><textPath href="#hood-rl-path" startOffset="44%">Rosa-Luxemburg-Straße</textPath></text>
            <text dy="4"><textPath href="#hood-a66-path" startOffset="46%">A66</textPath></text>
          </g>

          {/* SV Blau-Gelb: the running track and two football pitches, next door to the north. */}
          <g className="hood-ground" filter="url(#hood-lift)" style={{ "--i": 0 } as CSSProperties}>
            <g transform="rotate(16 568 240)">
              <rect x="528" y="166" width="80" height="148" rx="40" fill="#c8664a" />
              <rect x="532" y="170" width="72" height="140" rx="36" fill="none" stroke="#e0937a" strokeWidth="1" />
              <rect x="540" y="182" width="56" height="116" rx="28" fill="#86c465" />
              <rect x="540" y="182" width="56" height="116" rx="28" fill="none" stroke="#ffffff" strokeWidth="1.2" opacity=".7" />
            </g>
            {[
              { x: 672, y: 232, h: 104 },
              { x: 646, y: 322, h: 84 },
            ].map((p) => (
              <g key={p.y} transform={`rotate(16 ${p.x} ${p.y})`}>
                <rect x={p.x - 28} y={p.y - p.h / 2} width="56" height={p.h} fill="#78bb5b" />
                {[0, 1, 2, 3].map((k) => (
                  <rect key={k} x={p.x - 28} y={p.y - p.h / 2 + (k * p.h) / 4} width="56" height={p.h / 8} fill="#6fb153" />
                ))}
                <rect x={p.x - 24} y={p.y - p.h / 2 + 4} width="48" height={p.h - 8} fill="none" stroke="#ffffff" strokeWidth="1.4" />
                <line x1={p.x - 24} x2={p.x + 24} y1={p.y} y2={p.y} stroke="#ffffff" strokeWidth="1.4" />
                <circle cx={p.x} cy={p.y} r="7" fill="none" stroke="#ffffff" strokeWidth="1.4" />
              </g>
            ))}
          </g>
          <text className="hood-tag hood-tag-in" x="672" y="236" textAnchor="middle" transform="rotate(-74 672 232)">
            {t.football}
          </text>
          <text className="hood-tag" x="512" y="146" textAnchor="middle">
            {t.track}
          </text>

          {/* The courts the shop sits among: clay for tennis, blue for padel. */}
          <g className="hood-ground" filter="url(#hood-lift)" style={{ "--i": 1 } as CSSProperties}>
            <g transform="rotate(16 615 385)">
              {[0, 1, 2].map((i) => (
                <g key={i}>
                  <rect x={584 + i * 22} y="352" width="19" height="40" fill="#d8764c" />
                  <rect x={586 + i * 22} y="355" width="15" height="34" fill="none" stroke="#ffffff" strokeWidth=".9" />
                  <line x1={584 + i * 22} x2={603 + i * 22} y1="372" y2="372" stroke="#ffffff" strokeWidth="1.2" />
                </g>
              ))}
              {[0, 1].map((i) => (
                <g key={i}>
                  <rect x={608 + i * 18} y="398" width="15" height="28" rx="1.5" fill="#3a78c9" />
                  <rect x={608 + i * 18} y="398" width="15" height="28" rx="1.5" fill="none" stroke="#9cc3f0" strokeWidth="1" />
                  <line x1={608 + i * 18} x2={623 + i * 18} y1="412" y2="412" stroke="#ffffff" strokeWidth="1.2" />
                </g>
              ))}
            </g>
          </g>
          <text className="hood-tag" x="572" y="362" textAnchor="end">
            {t.tennis}
          </text>
          <text className="hood-tag" x="648" y="442">
            {t.padel}
          </text>

          <text className="hood-area-label" x="372" y="226">
            {t.park}
          </text>
          <text className="hood-tag hood-tag-soft" x="478" y="252" textAnchor="middle">
            {t.gardens}
          </text>

          {/* The park's two everyday landmarks and the hospital on the far side. */}
          <Poi x={395} y={488} kind="sport" label={t.fitness} i={0} />
          <Poi x={712} y={84} kind="play" label={t.playground} i={1} />
          <Poi x={1030} y={556} kind="health" label="Markus-Krankenhaus" i={2} below />

          {/* The walks from the U-Bahn and the S-Bahn, drawn in. */}
          <path className="hood-route hood-route-u" d={uWalk} />
          <path className="hood-route hood-route-s" d={sWalk} />

          <a href={hrefs[0]} target="_blank" rel="noreferrer" tabIndex={-1} className="hood-stop" style={{ "--i": 0 } as CSSProperties}>
            <rect x={U_STOP.x - 14} y={U_STOP.y - 14} width="28" height="28" rx="6" fill="#1a5aa6" stroke="#ffffff" strokeWidth="2.5" />
            <text x={U_STOP.x} y={U_STOP.y + 6} className="hood-glyph" textAnchor="middle">
              U
            </text>
            <text x={U_STOP.x + 14} y={U_STOP.y + 36} className="hood-label" textAnchor="end">
              Ginnheim Mitte
            </text>
            <text x={U_STOP.x + 14} y={U_STOP.y + 53} className="hood-tag hood-tag-u" textAnchor="end">
              U1 · U9 · 16 · {t.minutes(10)}
            </text>
          </a>
          <a href={hrefs[1]} target="_blank" rel="noreferrer" tabIndex={-1} className="hood-stop" style={{ "--i": 1 } as CSSProperties}>
            <circle cx={S_STOP.x} cy={S_STOP.y} r="15" fill="#0a8a3a" stroke="#ffffff" strokeWidth="2.5" />
            <text x={S_STOP.x} y={S_STOP.y + 6} className="hood-glyph" textAnchor="middle">
              S
            </text>
            <text x={S_STOP.x - 22} y={S_STOP.y - 4} className="hood-label" textAnchor="end">
              Frankfurt-Ginnheim
            </text>
            <text x={S_STOP.x - 22} y={S_STOP.y + 13} className="hood-tag hood-tag-s" textAnchor="end">
              S6 · {t.minutes(12)}
            </text>
          </a>
          <a href={hrefs[2]} target="_blank" rel="noreferrer" tabIndex={-1} className="hood-stop" style={{ "--i": 2 } as CSSProperties}>
            <rect x="1036" y="694" width="70" height="30" rx="15" fill="#17384b" stroke="#ffffff" strokeWidth="2" />
            <path d="M1050 714 h28 v-5 l-5 -6 h-16 l-5 6 Z M1054 715 a2.6 2.6 0 1 0 0.01 0 M1074 715 a2.6 2.6 0 1 0 0.01 0" fill="#ffffff" />
            <path d="M1086 709 h10 m-4 -4 l4 4 l-4 4" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <text x="1104" y="684" textAnchor="end" className="hood-label hood-label-blue">
              {t.centre}
            </text>
          </a>

          {/* La Cordobesa: the badge on a stalk, the name as in the header. */}
          <a href={CONTACT.mapsUrl} target="_blank" rel="noreferrer" tabIndex={-1} className="hood-here">
            <ellipse cx={VENUE.x} cy={VENUE.y + 2} rx="14" ry="5" fill="#17384b" opacity=".25" />
            <circle className="hood-pulse" cx={VENUE.x} cy={VENUE.y} r="20" />
            <line x1={VENUE.x} y1={VENUE.y} x2={VENUE.x} y2={VENUE.y - 34} stroke="#17384b" strokeWidth="3" strokeLinecap="round" />
            <g className="hood-badge-mark" filter="url(#hood-lift)">
              <circle cx={VENUE.x} cy={VENUE.y - 58} r="27" fill="#ffffff" />
              <image className="hood-logo" href={LOGO.full} x={VENUE.x - 25} y={VENUE.y - 83} width="50" height="50" />
            </g>
            <g className="hood-callout">
              <rect x={VENUE.x + 34} y={VENUE.y - 84} width="196" height="54" rx="10" />
              <text x={VENUE.x + 48} y={VENUE.y - 56} className="hood-brand">
                {t.here}
              </text>
              <text x={VENUE.x + 48} y={VENUE.y - 39} className="hood-brand-sub">
                PASTELERÍA ARGENTINA
              </text>
            </g>
          </a>

          {/* Light from the top left and a little shade at the far corner: the page lit like paper. */}
          <rect x="320" y="0" width="800" height="830" fill="url(#hood-light)" pointerEvents="none" />
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

function Poi({ x, y, kind, label, i, below }: { x: number; y: number; kind: "sport" | "play" | "health"; label: string; i: number; below?: boolean }) {
  const glyph = { fill: "none", stroke: "#ffffff", strokeWidth: 1.8, strokeLinecap: "round" as const };
  return (
    <g className={`hood-poi hood-poi-${kind}`} style={{ "--i": i } as CSSProperties}>
      <circle cx={x} cy={y} r="12" />
      {kind === "sport" && <circle {...glyph} cx={x} cy={y} r="5" />}
      {kind === "play" && <path {...glyph} d={`M${x} ${y + 6} V${y} M${x - 5} ${y + 1} L${x} ${y - 6} L${x + 5} ${y + 1} Z`} />}
      {kind === "health" && <path {...glyph} strokeWidth={2.4} d={`M${x} ${y - 5} V${y + 5} M${x - 5} ${y} H${x + 5}`} />}
      <text x={below ? x : x + 18} y={below ? y + 30 : y + 5} textAnchor={below ? "middle" : "start"} className="hood-label">
        {label}
      </text>
    </g>
  );
}
