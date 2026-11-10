import Image from "next/image";

/**
 * The province of Córdoba, drifting behind the story chapter.
 *
 * La Cordobesa is a piece of Córdoba in Frankfurt, and the map says that without a word: it sits
 * behind the story copy at a whisper of opacity and moves with the scroll (see .cordoba-backdrop
 * in globals.css), so it is something the reader notices while reading about the shop, never a
 * thing to explore. It is deliberately not interactive and not readable as a map — no zoom, no
 * labels to study — the way a mural on the wall is decoration, not a document.
 *
 * Pure decoration: hidden from assistive technology, and the image carries no alt because the
 * story text is the information. The SVG is one static asset, so the whole effect costs one lazy
 * request and no JavaScript; the motion is a scroll-driven CSS animation, which simply does not
 * run for a reader who asked for less movement or whose browser has no scroll timelines.
 */
export function CordobaBackdrop() {
  return (
    <div className="cordoba-backdrop" aria-hidden="true">
      {/* unoptimized: an SVG has nothing for the optimizer to resize, and this keeps the file
          served exactly as authored. The intrinsic size is the map's viewBox. */}
      <Image src="/assets/cordoba-map.svg" alt="" width={1000} height={1500} unoptimized />
    </div>
  );
}
