import type { CSSProperties } from "react";
import { getDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/i18n";

/**
 * The few streets round the shop, drawn in the colours people know from a map app: the Niddapark
 * and the allotments in green, the SV Blau-Gelb ground with its track and pitches next door, the
 * tennis and padel courts the shop sits among, the restaurants and the U-Bahn nearby, the A66 and
 * Rosa-Luxemburg-Straße as the yellow roads that frame it.
 *
 * Drawn by hand from the map view of the area (roughly to scale, north up) rather than embedded,
 * so it costs no request, no third-party cookie and no script, and it can be in the brand's
 * colours. The coordinates are those of that view (1300 × 830); the viewBox crops the part that
 * matters.
 *
 * The SVG is decoration (aria-hidden); the routes are written out in the list underneath, which is
 * what a crawler and a screen reader get. It animates with the scroll in CSS (see .hood in
 * globals.css): the green spreads, the grounds and places land one after another, and the walk
 * from the U-Bahn is drawn in. With reduced motion it is simply the finished drawing.
 */

const VENUE = { x: 625, y: 378 };
const U_STOP = { x: 990, y: 208 };

type Poi = { x: number; y: number; label: string; kind: "food" | "sport" | "play" | "health"; dy?: number; anchor?: "start" | "end" | "middle" };

export function NeighbourhoodMap({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).home.neighbourhood;

  const pois: Poi[] = [
    { x: 640, y: 158, label: "Le Phenix", kind: "food", anchor: "start" },
    { x: 1030, y: 46, label: "Sanmaru", kind: "food", anchor: "start" },
    { x: 395, y: 488, label: t.fitness, kind: "sport", anchor: "start" },
    { x: 712, y: 84, label: t.playground, kind: "play", anchor: "start" },
    { x: 1030, y: 556, label: "Markus-Krankenhaus", kind: "health", anchor: "middle", dy: 30 },
  ];

  const walk = `M${U_STOP.x} ${U_STOP.y} C 930 196, 862 170, 792 150 C 762 222, 716 300, ${VENUE.x + 22} ${VENUE.y - 6}`;

  return (
    <figure className="hood">
      <svg className="hood-map" viewBox="320 0 800 830" aria-hidden="true" focusable="false">
        <defs>
          <pattern id="hood-blocks" width="34" height="26" patternUnits="userSpaceOnUse" patternTransform="rotate(8)">
            <rect x="3" y="3" width="24" height="15" rx="2" fill="#e4ddd2" />
          </pattern>
          <pattern id="hood-plots" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(-14)">
            <rect width="16" height="16" fill="#cfe6bf" />
            <rect x="1.5" y="1.5" width="13" height="13" rx="1.5" fill="#bfdcab" />
          </pattern>
          <pattern id="hood-trees" width="22" height="22" patternUnits="userSpaceOnUse">
            <circle cx="6" cy="7" r="5" fill="#9fcc8b" />
            <circle cx="17" cy="16" r="4" fill="#a7d293" />
          </pattern>
          <path id="hood-street-path" d="M790 40 C 740 210, 650 430, 562 830" />
          <path id="hood-a66-path" d="M330 610 C 640 650, 860 712, 1130 760" />
          <path id="hood-rl-path" d="M860 90 C 940 140, 1040 162, 1130 180" />
        </defs>

        {/* Land, then the town east of the railway. */}
        <rect x="320" y="0" width="800" height="830" fill="#f4f1ea" />
        <path className="hood-area" d="M780 140 L 1120 120 L 1120 470 L 960 470 L 950 520 L 1120 530 L 1120 830 L 980 830 L 960 700 L 800 470 Z" fill="url(#hood-blocks)" />

        {/* The Niddapark, its woods and the allotments between it and the courts. */}
        <g className="hood-area hood-green" style={{ "--i": 0 } as CSSProperties}>
          <path d="M320 0 L 770 0 L 742 140 L 610 150 L 560 122 L 430 118 L 404 260 L 458 384 L 560 410 L 604 436 L 580 560 L 556 650 L 540 700 L 320 660 Z" fill="#c4e3ad" />
          <path d="M330 300 C 380 270, 420 330, 400 420 C 380 500, 340 520, 320 470 Z" fill="url(#hood-trees)" />
          <path d="M470 440 C 520 430, 560 470, 540 560 C 520 620, 470 600, 460 540 Z" fill="url(#hood-trees)" />
          <path d="M330 40 C 390 20, 440 60, 420 110 C 400 150, 350 140, 330 110 Z" fill="url(#hood-trees)" />
          <path d="M420 128 L 556 132 L 520 300 L 545 404 L 458 380 L 408 262 Z" fill="url(#hood-plots)" />
          <path d="M650 470 L 940 476 L 948 700 L 600 712 L 620 560 Z" fill="url(#hood-plots)" />
          {/* Paths through the park. */}
          <path d="M330 220 C 400 180, 450 220, 470 300 S 540 420, 600 430 M360 560 C 420 520, 480 500, 556 420 M400 100 C 470 140, 500 120, 560 128" fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" opacity=".75" />
        </g>

        {/* Roads: the residential grid, the street, the railway, and the two yellow arteries. */}
        <g className="hood-roads" fill="none" strokeLinecap="round">
          <path d="M800 320 L 1000 344 M808 440 L 952 456 M1000 240 L 1120 268 M850 170 L 862 460 M960 176 L 968 830 M960 474 C 1040 480, 1090 500, 1120 512" stroke="#ffffff" strokeWidth="7" />
          <use href="#hood-street-path" stroke="#d9d2c4" strokeWidth="13" />
          <use href="#hood-street-path" stroke="#ffffff" strokeWidth="9" />
          <path d="M818 0 C 780 200, 690 430, 594 830" stroke="#9aa3a8" strokeWidth="5" />
          <path d="M818 0 C 780 200, 690 430, 594 830" stroke="#ffffff" strokeWidth="2" strokeDasharray="10 10" />
          <use href="#hood-rl-path" stroke="#e5b94f" strokeWidth="20" />
          <use href="#hood-rl-path" stroke="#f8dc86" strokeWidth="15" />
          <path d="M790 0 C 820 60, 840 80, 860 90" stroke="#e5b94f" strokeWidth="20" />
          <path d="M790 0 C 820 60, 840 80, 860 90" stroke="#f8dc86" strokeWidth="15" />
          <use href="#hood-a66-path" stroke="#e5b94f" strokeWidth="22" />
          <use href="#hood-a66-path" stroke="#f8dc86" strokeWidth="17" />
        </g>
        <g className="hood-road-label">
          <text dy="4"><textPath href="#hood-street-path" startOffset="18%">Am Ginnheimer Wäldchen</textPath></text>
          <text dy="4"><textPath href="#hood-rl-path" startOffset="30%">Rosa-Luxemburg-Straße</textPath></text>
          <text dy="4"><textPath href="#hood-a66-path" startOffset="44%">A66</textPath></text>
        </g>

        {/* SV Blau-Gelb: the running track and two football pitches, next door to the north. */}
        <g className="hood-ground" style={{ "--i": 1 } as CSSProperties}>
          <g transform="rotate(16 568 240)">
            <rect x="528" y="166" width="80" height="148" rx="40" fill="#c8664a" />
            <rect x="540" y="182" width="56" height="116" rx="28" fill="#8fca6e" />
            <rect x="540" y="182" width="56" height="116" rx="28" fill="none" stroke="#ffffff" strokeWidth="1.2" opacity=".7" />
          </g>
          {[
            { x: 672, y: 232, h: 104 },
            { x: 646, y: 322, h: 84 },
          ].map((p) => (
            <g key={p.y} transform={`rotate(16 ${p.x} ${p.y})`}>
              <rect x={p.x - 28} y={p.y - p.h / 2} width="56" height={p.h} fill="#7fc062" />
              <rect x={p.x - 24} y={p.y - p.h / 2 + 4} width="48" height={p.h - 8} fill="none" stroke="#ffffff" strokeWidth="1.4" />
              <line x1={p.x - 24} x2={p.x + 24} y1={p.y} y2={p.y} stroke="#ffffff" strokeWidth="1.4" />
              <circle cx={p.x} cy={p.y} r="7" fill="none" stroke="#ffffff" strokeWidth="1.4" />
            </g>
          ))}
          <text className="hood-tag hood-tag-in" x="672" y="236" textAnchor="middle" transform="rotate(-74 672 232)">
            {t.football}
          </text>
          <text className="hood-tag" x="512" y="146" textAnchor="middle">
            {t.track}
          </text>
        </g>

        {/* The courts the shop sits among: clay for tennis, blue for padel. */}
        <g className="hood-ground" style={{ "--i": 2 } as CSSProperties}>
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
                <line x1={608 + i * 18} x2={623 + i * 18} y1="412" y2="412" stroke="#ffffff" strokeWidth="1.2" />
              </g>
            ))}
          </g>
          <text className="hood-tag" x="572" y="362" textAnchor="end">
            {t.tennis}
          </text>
          <text className="hood-tag" x="648" y="440">
            {t.padel}
          </text>
        </g>

        {/* The park's name, the allotments. */}
        <text className="hood-area-label" x="372" y="226" style={{ "--i": 0 } as CSSProperties}>
          {t.park}
        </text>
        <text className="hood-tag hood-tag-soft" x="478" y="252" textAnchor="middle">
          {t.gardens}
        </text>

        {/* The walk from the U-Bahn, drawn in. */}
        <path className="hood-walk" d={walk} />
        <g className="hood-stop">
          <rect x={U_STOP.x - 13} y={U_STOP.y - 13} width="26" height="26" rx="5" fill="#1a5aa6" stroke="#ffffff" strokeWidth="2.5" />
          <text x={U_STOP.x} y={U_STOP.y + 5.5} className="hood-u" textAnchor="middle">
            U
          </text>
          <text x={U_STOP.x + 14} y={U_STOP.y + 34} className="hood-label" textAnchor="end">
            Ginnheim Mitte
          </text>
          <text x={U_STOP.x + 14} y={U_STOP.y + 52} className="hood-tag" textAnchor="end">
            U1 · U9 · 16 · {t.minutes(10)}
          </text>
        </g>

        {pois.map((p, i) => (
          <g key={p.label} className={`hood-poi hood-poi-${p.kind}`} style={{ "--i": i } as CSSProperties}>
            <circle cx={p.x} cy={p.y} r="12" />
            <PoiGlyph kind={p.kind} x={p.x} y={p.y} />
            <text
              x={p.anchor === "middle" ? p.x : p.x + 18}
              y={p.y + (p.dy ?? 5)}
              textAnchor={p.anchor ?? "start"}
              className="hood-label"
            >
              {p.label}
            </text>
          </g>
        ))}

        {/* Which way the city is. */}
        <g className="hood-centre">
          <path d="M1040 770 L 1098 808 M1098 808 L 1082 790 M1098 808 L 1076 806" fill="none" stroke="#226e99" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <text x="1096" y="742" textAnchor="end" className="hood-label hood-label-blue">
            {t.centre}
          </text>
        </g>

        <g className="hood-here">
          <circle className="hood-pulse" cx={VENUE.x} cy={VENUE.y} r="22" />
          <path
            d={`M${VENUE.x} ${VENUE.y + 4} C ${VENUE.x - 4} ${VENUE.y - 6}, ${VENUE.x - 16} ${VENUE.y - 14}, ${VENUE.x - 16} ${VENUE.y - 26} A 16 16 0 1 1 ${VENUE.x + 16} ${VENUE.y - 26} C ${VENUE.x + 16} ${VENUE.y - 14}, ${VENUE.x + 4} ${VENUE.y - 6}, ${VENUE.x} ${VENUE.y + 4} Z`}
            fill="#e14b52"
            stroke="#ffffff"
            strokeWidth="2.5"
          />
          <circle cx={VENUE.x} cy={VENUE.y - 26} r="6" fill="#ffffff" />
          <g className="hood-callout">
            <rect x={VENUE.x + 22} y={VENUE.y - 46} width="176" height="40" rx="20" />
            <text x={VENUE.x + 110} y={VENUE.y - 18} textAnchor="middle" className="hood-label-here">
              {t.here}
            </text>
          </g>
        </g>
      </svg>

      <figcaption className="hood-legend">
        <strong>{t.title}</strong>
        <ol>
          {t.steps.map((s) => (
            <li key={s.line}>
              <span className={`hood-badge hood-badge-${s.line.toLowerCase()}`}>{s.line}</span>
              {s.text}
            </li>
          ))}
        </ol>
        <small>{t.note}</small>
      </figcaption>
    </figure>
  );
}

/** A small white glyph inside a place's dot: knife and fork, a ball, a tree, a cross. */
function PoiGlyph({ kind, x, y }: { kind: Poi["kind"]; x: number; y: number }) {
  const common = { fill: "none", stroke: "#ffffff", strokeWidth: 1.8, strokeLinecap: "round" as const };
  if (kind === "food")
    return <path {...common} d={`M${x - 3} ${y - 6} V${y + 6} M${x - 5} ${y - 6} V${y - 2} Q${x - 3} ${y + 1} ${x - 1} ${y - 2} V${y - 6} M${x + 3} ${y + 6} V${y - 6} Q${x + 6} ${y - 3} ${x + 3} ${y}`} />;
  if (kind === "sport") return <circle {...common} cx={x} cy={y} r="5" />;
  if (kind === "play") return <path {...common} d={`M${x} ${y + 6} V${y} M${x - 5} ${y + 1} L${x} ${y - 6} L${x + 5} ${y + 1} Z`} />;
  return <path {...common} strokeWidth={2.4} d={`M${x} ${y - 5} V${y + 5} M${x - 5} ${y} H${x + 5}`} />;
}
