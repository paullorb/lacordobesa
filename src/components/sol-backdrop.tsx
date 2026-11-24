/**
 * The Sol de Mayo, turning behind the story chapter.
 *
 * The map of Córdoba belongs to the hero, so the story gets the other image every Argentine knows
 * on sight: the sun from the flag, with its thirty-two rays alternating straight and wavy. Drawn as
 * a single line in the gold of the flag, at a whisper of opacity, it reads as a mural behind the
 * copy rather than a picture to look at. It turns a few degrees with the scroll (see .sol-backdrop
 * in globals.css), which simply does not happen for a reader who asked for less movement.
 *
 * Computed rather than shipped as an asset: one inline SVG of a few kilobytes, no request, and the
 * rays come out evenly spaced. Pure decoration, hidden from assistive technology.
 */

const RAYS = 32;
const CENTER = 200;
const FACE = 62; // radius of the disc
const INNER = 76; // where the rays start
const STRAIGHT = 176; // tip of a straight ray
const WAVY = 164; // tip of a wavy ray
const HALF_WIDTH = 7; // half the base of a straight ray, in viewBox units

const f = (n: number) => n.toFixed(1);
const point = (r: number, angle: number) => [CENTER + r * Math.cos(angle), CENTER + r * Math.sin(angle)] as const;

function straightRay(angle: number) {
  const spread = HALF_WIDTH / INNER;
  const [ax, ay] = point(INNER, angle - spread);
  const [tx, ty] = point(STRAIGHT, angle);
  const [bx, by] = point(INNER, angle + spread);
  return `M${f(ax)} ${f(ay)}L${f(tx)} ${f(ty)}L${f(bx)} ${f(by)}`;
}

/** A flame: a sine wave along the ray, three crests, narrowing toward the tip. */
function wavyRay(angle: number) {
  const steps = 36;
  const parts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const r = INNER + (WAVY - INNER) * t;
    const offset = Math.sin(t * Math.PI * 3) * 6 * (1 - t * 0.6);
    const x = CENTER + r * Math.cos(angle) - offset * Math.sin(angle);
    const y = CENTER + r * Math.sin(angle) + offset * Math.cos(angle);
    parts.push(`${i === 0 ? "M" : "L"}${f(x)} ${f(y)}`);
  }
  return parts.join("");
}

const PATH = Array.from({ length: RAYS }, (_, i) => {
  const angle = (i / RAYS) * 2 * Math.PI - Math.PI / 2;
  return i % 2 === 0 ? straightRay(angle) : wavyRay(angle);
}).join("");

export function SolBackdrop() {
  return (
    <div className="sol-backdrop" aria-hidden="true">
      <svg aria-hidden="true" viewBox="0 0 400 400" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
        <circle cx={CENTER} cy={CENTER} r={FACE} />
        <circle cx={CENTER} cy={CENTER} r={FACE - 9} strokeWidth="1" />
        <path d={PATH} />
      </svg>
    </div>
  );
}
