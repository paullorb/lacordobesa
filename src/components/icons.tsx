/** Hand-drawn icons, in place of emoji.
 *
 *  Emoji were doing real work on this page: a dish category marker, the heart in the footer, the
 *  flag in the hero, the symbols in the contact block. The trouble is that an emoji is rendered by
 *  the reader's operating system, so the same page is a flat Twemoji on one machine and a glossy
 *  3D Apple glyph on another, at a size and weight nobody chose. Two of them, ⌖ and ◷, were not
 *  emoji at all but obscure dingbats that fall back to a box on Windows.
 *
 *  These are drawn instead: one weight, rounded caps, `currentColor`, so they take the colour of
 *  whatever they sit in and match the empanada mark the brand already uses.
 */

type IconProps = { size?: number; className?: string };

function Icon({ size = 20, className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {children}
    </svg>
  );
}

// ---------------------------------------------------------------- menu categories

const MENU_ICONS: Record<string, React.ReactNode> = {
  // A slice of bread on a plate.
  vorspeise: (
    <>
      <path d="M4 18.5h16" />
      <path d="M7.5 18.5c0-3.4 1.8-5.6 4.5-5.6s4.5 2.2 4.5 5.6" />
      <path d="M10 10.5c0-1.4.9-2.2 2-2.2s2 .8 2 2.2" />
    </>
  ),
  // The empanada: a filled half-moon with a crimped edge.
  empanadas: (
    <>
      <path d="M3.5 17.5c0-7.5 17-7.5 17 0Z" />
      <path d="M6.5 14.5c1.6-3.6 9.4-3.6 11 0" />
      <path d="M5 17.5v2M8 17.5v2M11 17.5v2M14 17.5v2M17 17.5v2M19.8 17.5v1.8" />
    </>
  ),
  // A bowl with a tangle of pasta above it.
  pasta: (
    <>
      <path d="M3 13h18c0 4.5-4 7.5-9 7.5S3 17.5 3 13Z" />
      <path d="M7 10.5c.8-2 2.4-2 3.2 0M12 10.5c.8-2 2.4-2 3.2 0" />
      <path d="M9.6 7.5c.8-1.8 2.4-1.8 3.2 0" />
    </>
  ),
  // Choripán: a sausage laid in a split roll.
  clasico: (
    <>
      <path d="M3 14.5c0-3.2 18-3.2 18 0s-18 3.2-18 0Z" />
      <path d="M5.5 13.2c1-1.4 12-1.4 13 0" />
      <path d="M8 11.4l1.4 1.2M11 11.2l1.4 1.2M14 11.4l1.4 1.2" />
    </>
  ),
  // A slice, crust at the top.
  pizzas: (
    <>
      <path d="M4.5 7.5c4.6-2 10.4-2 15 0L12 20.5Z" />
      <path d="M4.5 7.5c4.6-2 10.4-2 15 0" />
      <circle cx="10" cy="11" r=".9" fill="currentColor" stroke="none" />
      <circle cx="14" cy="12.5" r=".9" fill="currentColor" stroke="none" />
      <circle cx="11.6" cy="15.6" r=".9" fill="currentColor" stroke="none" />
    </>
  ),
  // A cut of beef with grill marks.
  hauptgerichte: (
    <>
      <path d="M4.6 11c1.4-4.4 12-5.4 14.4-1.4s-1.2 9.8-6.6 10S3.2 15.4 4.6 11Z" />
      <path d="M8.6 10.6l2.2 2.2M11.4 9.6l2.2 2.2M14.2 9.2l2 2" />
    </>
  ),
  // Flan on a plate, with the caramel running off it.
  desserts: (
    <>
      <path d="M4 18.5h16" />
      <path d="M6.6 18.5c0-4.6 2.2-7.4 5.4-7.4s5.4 2.8 5.4 7.4Z" />
      <path d="M9 12.4c1-.9 1.8-.9 2.6 0s1.8.9 2.8 0" />
    </>
  ),
  // A tall glass with a straw.
  alkoholfrei: (
    <>
      <path d="M7 7.5h10l-1.4 13H8.4Z" />
      <path d="M7.6 11.5h8.8" />
      <path d="M14.6 4l-1.8 3.5" />
    </>
  ),
  // A stein with a head on it.
  alkoholisch: (
    <>
      <path d="M6 9.5h10v11H6Z" />
      <path d="M16 11.5h2.4a2 2 0 0 1 0 4.4H16" />
      <path d="M6 9.5c0-2.4 2.2-3.6 5-3.6s5 1.2 5 3.6" />
    </>
  ),
  // A cup with steam.
  heiss: (
    <>
      <path d="M4.5 10.5h12v4.6a4.6 4.6 0 0 1-4.6 4.6H9.1a4.6 4.6 0 0 1-4.6-4.6Z" />
      <path d="M16.5 11.8h2a2.1 2.1 0 0 1 0 4.2h-2" />
      <path d="M8.4 4.2v2.8M12 3.6v3.4" />
    </>
  ),
  // A coupe, with the olive.
  cocktails: (
    <>
      <path d="M4.5 6.5h15L12 14Z" />
      <path d="M12 14v5.5M8.6 19.5h6.8" />
      <circle cx="15" cy="9" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
};

/** A small star, for a category nobody has drawn yet. */
const FALLBACK = <path d="M12 4.5l1.7 5.3 5.3 1.7-5.3 1.7L12 18.5l-1.7-5.3L5 11.5l5.3-1.7Z" />;

export function MenuIcon({ slug, size = 20, className }: IconProps & { slug: string }) {
  return (
    <Icon size={size} className={className}>
      {MENU_ICONS[slug] ?? FALLBACK}
    </Icon>
  );
}

// ---------------------------------------------------------------- celebrations

/** One drawing per occasion in lib/events.ts, so the first question of the celebration wizard is
 *  six pictures rather than six lines of German. Keyed by the same codes the database constrains,
 *  with a fallback for anything added to the list before somebody draws it. */
const OCCASION_ICONS: Record<string, React.ReactNode> = {
  // A cake with one candle.
  geburtstag: (
    <>
      <path d="M4 19.5h16" />
      <path d="M5.5 19.5v-6.2c0-1 .8-1.8 1.8-1.8h9.4c1 0 1.8.8 1.8 1.8v6.2" />
      <path d="M5.5 15.2c1.5 1.1 3 1.1 4.3 0 1.4 1.1 2.9 1.1 4.3 0 1.3 1.1 2.8 1.1 4.4 0" />
      <path d="M12 11.5V8.8" />
      <path d="M12 4.5c1.4 1.3 1.4 2.5 0 3.3-1.4-.8-1.4-2 0-3.3Z" />
    </>
  ),
  // A long table laid for a company dinner.
  firmenfeier: (
    <>
      <path d="M3 10.5h18" />
      <path d="M4.8 10.5v9M19.2 10.5v9" />
      <path d="M7.5 7.2v3.3M12 6.2v4.3M16.5 7.2v3.3" />
      <circle cx="7.5" cy="5.6" r="1.5" />
      <circle cx="12" cy="4.6" r="1.5" />
      <circle cx="16.5" cy="5.6" r="1.5" />
    </>
  ),
  // A lit baptism candle.
  taufe: (
    <>
      <path d="M9 10.5h6v9H9Z" />
      <path d="M9 14h6" />
      <path d="M12 10.5V8" />
      <path d="M12 3.5c2 2.2 2 3.8 0 4.5-2-.7-2-2.3 0-4.5Z" />
    </>
  ),
  // Two rings.
  hochzeit: (
    <>
      <circle cx="9" cy="14.5" r="5" />
      <circle cx="15.5" cy="14.5" r="5" />
      <path d="M12.2 4.5 10 7.2h4.4Z" />
    </>
  ),
  // A tray under a cloche, carried out of the door.
  catering: (
    <>
      <path d="M3 18.5h18" />
      <path d="M5.5 16.2a6.5 6.5 0 0 1 13 0Z" />
      <path d="M12 9.7V7.5" />
      <path d="M8.5 20.8h7" />
    </>
  ),
  // Three sparks: something we have not thought of yet.
  andere: (
    <>
      <path d="M8.5 4.5 9.7 8l3.5 1.2-3.5 1.2-1.2 3.5-1.2-3.5L3.8 9.2 7.3 8Z" />
      <path d="M16.8 12.5l.8 2.3 2.4.8-2.4.8-.8 2.3-.8-2.3-2.4-.8 2.4-.8Z" />
      <path d="M15.6 4.2v3M14.1 5.7h3" />
    </>
  ),
};

export function OccasionIcon({ code, size = 22, className }: IconProps & { code: string }) {
  return (
    <Icon size={size} className={className}>
      {OCCASION_ICONS[code] ?? FALLBACK}
    </Icon>
  );
}

// ---------------------------------------------------------------- arrows

/** The arrows the copy used to set as characters.
 *
 *  ↗ was the one that gave the game away: U+2197 has an emoji presentation, so iOS drew it as a
 *  flat blue system glyph next to a page of hand-drawn line icons. The other three are honest text
 *  arrows, but they are the system font's arrows, at the system font's weight, which is not the
 *  1.6px rounded stroke everything else here is drawn with. */
const ARROWS: Record<string, React.ReactNode> = {
  "up-right": (
    <>
      <path d="M7.4 16.6 16.6 7.4" />
      <path d="M9.4 7.4h7.2v7.2" />
    </>
  ),
  right: (
    <>
      <path d="M4.5 12h14" />
      <path d="M12.8 6.3 18.5 12l-5.7 5.7" />
    </>
  ),
  left: (
    <>
      <path d="M19.5 12h-14" />
      <path d="M11.2 6.3 5.5 12l5.7 5.7" />
    </>
  ),
  down: (
    <>
      <path d="M12 4.5v14" />
      <path d="M6.3 11.2 12 16.9l5.7-5.7" />
    </>
  ),
};

export type ArrowDirection = keyof typeof ARROWS & ("up-right" | "right" | "left" | "down");

/**
 * An arrow, drawn.
 *
 * Decorative by default, because an arrow after "Website" or "Weiter" repeats what the words
 * already say. Where the arrow *is* the label (the month stepper in the staff calendar) the
 * surrounding control carries an aria-label and this stays hidden all the same.
 *
 * `icon-inline` sits it on the text baseline. In a flex button, which most of these are, it
 * changes nothing.
 */
export const ArrowIcon = ({ direction, size = 16, className }: IconProps & { direction: ArrowDirection }) => (
  <Icon size={size} className={className ? `icon-inline ${className}` : "icon-inline"}>
    {ARROWS[direction]}
  </Icon>
);

// ---------------------------------------------------------------- the rest

export const HeartIcon = ({ size = 14, className }: IconProps) => (
  <Icon size={size} className={className}>
    <path d="M12 20.3C6.6 16.9 3.5 13.9 3.5 10.3A4.3 4.3 0 0 1 12 8.4a4.3 4.3 0 0 1 8.5 1.9c0 3.6-3.1 6.6-8.5 10Z" />
  </Icon>
);

/** The Argentine flag: two bands and the sun, drawn rather than the 🇦🇷 emoji, which several
 *  platforms render as the letters "AR" in a box. */
export const ArgentinaIcon = ({ size = 16, className }: IconProps) => (
  <Icon size={size} className={className}>
    <rect x="2.5" y="5.5" width="19" height="13" rx="1.6" />
    <path d="M2.5 10h19M2.5 14h19" />
    <circle cx="12" cy="12" r="1.7" />
  </Icon>
);

export const PinIcon = ({ size = 18, className }: IconProps) => (
  <Icon size={size} className={className}>
    <path d="M12 21c4-4.6 6-7.9 6-10.5a6 6 0 1 0-12 0C6 13.1 8 16.4 12 21Z" />
    <circle cx="12" cy="10.4" r="2.2" />
  </Icon>
);

export const ClockIcon = ({ size = 18, className }: IconProps) => (
  <Icon size={size} className={className}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.4V12l3.2 2" />
  </Icon>
);

export const PhoneIcon = ({ size = 18, className }: IconProps) => (
  <Icon size={size} className={className}>
    <path d="M7.4 3.8 9.9 4.6a1.4 1.4 0 0 1 .9 1.7l-.6 2.2a1.4 1.4 0 0 1-1.2 1l-1.3.2a11.4 11.4 0 0 0 6.6 6.6l.2-1.3a1.4 1.4 0 0 1 1-1.2l2.2-.6a1.4 1.4 0 0 1 1.7.9l.8 2.5a1.5 1.5 0 0 1-1 1.9A14.8 14.8 0 0 1 5.5 6.5a1.5 1.5 0 0 1 1.9-1Z" />
  </Icon>
);

export const MailIcon = ({ size = 18, className }: IconProps) => (
  <Icon size={size} className={className}>
    <rect x="2.8" y="5.5" width="18.4" height="13" rx="2" />
    <path d="m3.6 7 7.3 5.3a2 2 0 0 0 2.2 0L20.4 7" />
  </Icon>
);
