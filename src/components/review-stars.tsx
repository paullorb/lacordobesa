/** Five stars filled to `value` (0 to 5), drawn as SVG like the rest of the site's icons.
 *
 *  Decorative: the number next to it carries the meaning, and the card's link names it, so this is
 *  aria-hidden. The filled layer is clipped to the exact share, so 4,3 of 5 shows 4 and a bit stars
 *  rather than rounding up. */
const STAR = "M12 2.5l2.94 6.1 6.68.86-4.9 4.62 1.24 6.62L12 17.4l-5.96 3.3 1.24-6.62-4.9-4.62 6.68-.86z";

function Row() {
  return (
    <>
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} aria-hidden="true" viewBox="0 0 24 24" width="16" height="16">
          <path d={STAR} />
        </svg>
      ))}
    </>
  );
}

export function ReviewStars({ value }: { value: number }) {
  return (
    <span className="stars" aria-hidden="true">
      <span className="stars-base">
        <Row />
      </span>
      <span className="stars-fill" style={{ width: `${(value / 5) * 100}%` }}>
        <Row />
      </span>
    </span>
  );
}
