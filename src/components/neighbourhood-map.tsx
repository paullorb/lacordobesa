import { getDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/i18n";

/**
 * How far the shop is from what gets people here: a walking-time map rather than a street map.
 *
 * The rings are minutes on foot from the door, and every stop sits on the ring of its own walking
 * time (bus 69 at Am Mühlgarten 3, Ginnheim Mitte 10, the S6 at Frankfurt-Ginnheim 12; times from
 * the transit planner). The angles are not compass bearings, which is why the map says it is
 * schematic: a street map needs tiles or a provider, and this needs neither.
 *
 * Drawn by the server as inline SVG, so it costs no request and no script. The routes are written
 * out in the ordered list next to it, which is the copy a crawler and a screen reader get; the SVG
 * itself is decoration (aria-hidden). It animates with the scroll in CSS (see .hood in
 * globals.css): the rings spread, the stops land, and the U1 is drawn in from the city centre.
 * With reduced motion it is simply the finished drawing.
 *
 * Sports grounds and restaurants nearby can join it as further stops on their own rings once their
 * walking times are confirmed.
 */

const C = { x: 300, y: 300 };
/** Pixels per minute on foot. */
const PX = 17;
const RINGS = [3, 6, 9, 12];

const at = (minutes: number, degrees: number) => {
  const a = (degrees * Math.PI) / 180;
  return { x: +(C.x + Math.cos(a) * minutes * PX).toFixed(1), y: +(C.y + Math.sin(a) * minutes * PX).toFixed(1) };
};

const STOPS = [
  { id: "bus", line: "69", name: "Am Mühlgarten", minutes: 3, angle: -135, color: "#9b4f96" },
  { id: "u", line: "U1", name: "Ginnheim Mitte", minutes: 10, angle: -38, color: "#c8102e" },
  { id: "s", line: "S6", name: "Frankfurt-Ginnheim", minutes: 12, angle: 158, color: "#0a8a3a" },
] as const;

export function NeighbourhoodMap({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).home.neighbourhood;
  const u = at(10, -38);
  const tower = at(14, 62);
  // The U1 comes in from the city centre, beyond the map's bottom right corner, bending once.
  const u1 = `M640 640 C 590 560, 560 330, ${u.x + 30} ${u.y + 40} S ${u.x + 8} ${u.y + 6}, ${u.x} ${u.y}`;

  return (
    <figure className="hood">
      <svg className="hood-map" viewBox="0 0 600 600" aria-hidden="true" focusable="false">
        <defs>
          <radialGradient id="hood-glow">
            <stop offset="0" stopColor="#52aee1" stopOpacity=".28" />
            <stop offset="1" stopColor="#52aee1" stopOpacity="0" />
          </radialGradient>
          <pattern id="hood-dots" width="18" height="18" patternUnits="userSpaceOnUse">
            <circle cx="1.5" cy="1.5" r="1.2" fill="#17384b" opacity=".09" />
          </pattern>
        </defs>
        <rect width="600" height="600" fill="url(#hood-dots)" />
        <circle cx={C.x} cy={C.y} r="240" fill="url(#hood-glow)" />

        {/* The little wood the street is named after, right behind the door. */}
        <g transform="translate(6 34)">
          <path
            className="hood-woods"
            d="M262 330 C 236 352, 238 398, 270 410 C 300 422, 338 404, 340 378 C 342 352, 318 340, 300 344 C 284 348, 280 322, 262 330 Z"
          />
        </g>
        <text className="hood-label hood-label-woods" x="296" y="474" textAnchor="middle">
          {t.woods}
        </text>

        {RINGS.map((m, i) => (
          <g key={m} className="hood-ring" style={{ "--i": i } as React.CSSProperties}>
            <circle cx={C.x} cy={C.y} r={m * PX} />
            <text x={C.x - m * PX - 4} y={C.y - 4} className="hood-ring-label" textAnchor="end">
              {t.minutes(m)}
            </text>
          </g>
        ))}

        <path className="hood-u1" d={u1} />
        <text className="hood-label hood-centre" x="590" y="586" textAnchor="end">
          {t.centre}
        </text>

        {STOPS.map((s, i) => {
          const p = at(s.minutes, s.angle);
          return (
            <g key={s.id} className="hood-stop" style={{ "--i": i } as React.CSSProperties}>
              <path className="hood-walk" d={`M${C.x} ${C.y} L${p.x} ${p.y}`} />
              <circle cx={p.x} cy={p.y} r="15" fill={s.color} />
              <text x={p.x} y={p.y + 4.5} className="hood-line" textAnchor="middle">
                {s.line}
              </text>
              <text x={p.x} y={p.y + (s.angle < 0 ? -24 : 34)} className="hood-label" textAnchor="middle">
                {s.name} · {t.minutes(s.minutes)}
              </text>
            </g>
          );
        })}

        <g className="hood-tower">
          <path d={`M${tower.x} ${tower.y - 38} L${tower.x + 4} ${tower.y + 10} L${tower.x - 4} ${tower.y + 10} Z`} />
          <ellipse cx={tower.x} cy={tower.y - 22} rx="7" ry="4.5" />
          <text x={tower.x} y={tower.y + 28} className="hood-label" textAnchor="middle">
            {t.tower} · {t.towerNote}
          </text>
        </g>

        <g className="hood-here">
          <circle className="hood-pulse" cx={C.x} cy={C.y} r="22" />
          <circle cx={C.x} cy={C.y} r="11" fill="#e14b52" stroke="#ffffff" strokeWidth="3.5" />
          <text x={C.x + 22} y={C.y + 7} className="hood-label hood-label-here">
            {t.here}
          </text>
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
