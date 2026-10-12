/** The repulgue: the twisted, crimped edge an empanada is closed with, and the one detail every
 *  Cordobesa folds by hand. It is the site's recurring mark, a line of small leaning loops drawn as
 *  a single stroke so it can draw itself in (see `.repulgue` in globals.css).
 *
 *  The curve is a prolate cycloid, the path a point traces when it sits outside a rolling wheel:
 *  each turn makes one loop, and the loops overlap like folds of dough. Sheared forward so they lean
 *  the way a twisted edge does. Computed rather than drawn by hand so any number of folds comes out
 *  evenly spaced. Decorative, so it is hidden from assistive technology. */

const FOLD = 9; // width of one fold in viewBox units
const LOOP = 3; // > 1 makes the curve cross itself; this high, neighbouring loops overlap
const SHEAR = 0.6; // how far the loops lean forward
const STEPS = 22; // samples per fold; enough that the stroke reads as a smooth curve
const PAD = 1.2; // room for the stroke at the top and bottom

const R = FOLD / (2 * Math.PI);
const AMPLITUDE = R * LOOP;

/** Points on the curve for folds `from` up to `to`. */
function curve(from: number, to: number) {
  const points: [number, number][] = [];
  for (let i = from * STEPS; i <= to * STEPS; i++) {
    const t = (i / STEPS) * 2 * Math.PI;
    const y = -AMPLITUDE * Math.cos(t);
    points.push([R * (t - LOOP * Math.sin(t)) - SHEAR * y, y]);
  }
  return points;
}

function folds(count: number) {
  const points = curve(0, count);
  const xs = points.map(([x]) => x);
  const minX = Math.min(...xs) - PAD;
  const width = Math.max(...xs) + PAD - minX;
  const height = 2 * (AMPLITUDE + PAD);
  const d = `M${points.map(([x, y]) => `${(x - minX).toFixed(2)} ${(y + height / 2).toFixed(2)}`).join("L")}`;
  return { d, width, height };
}

export function Repulgue({ folds: count = 18, className }: { folds?: number; className?: string }) {
  const { d, width, height } = folds(count);
  return (
    <svg
      className={`repulgue${className ? ` ${className}` : ""}`}
      viewBox={`0 0 ${width.toFixed(2)} ${height.toFixed(2)}`}
      width={Math.round(width)}
      height={Math.round(height)}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {/* pathLength="1" lets the CSS draw it with a dash of 1 regardless of how long it really is. */}
      <path d={d} pathLength={1} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** One fold as a tileable image, for an edge too long to draw as a single path (the footer spans
 *  the window, which would be hundreds of folds of path data on every page).
 *
 *  Each turn of the curve ends exactly one fold to the right of where it began, so the curve is
 *  periodic. The tile draws three turns and crops to the middle one: whatever a loop pushes past
 *  the edge of its own tile, the neighbouring tile draws, and side by side they join without a
 *  seam. Used as a mask, so the colour comes from CSS. */
export function repulgueTile() {
  const height = 2 * (AMPLITUDE + PAD);
  const d = `M${curve(-1, 2)
    .map(([x, y]) => `${x.toFixed(2)} ${(y + height / 2).toFixed(2)}`)
    .join("L")}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${FOLD} ${height.toFixed(2)}"><path d="${d}" fill="none" stroke="#000" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
