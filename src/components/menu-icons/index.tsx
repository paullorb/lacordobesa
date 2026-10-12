import { MenuIcon } from "@/components/icons";
import { GLYPHS, type GlyphName } from "@/components/menu-icons/glyphs";

/** A "0" ring means the dish or drink is the version without: without alcohol, without caffeine.
 *  One badge for both keeps "Pils alkoholfrei" and "Dekoffinierter Kaffee" from needing a glyph
 *  each, and it is the same mark the printed card uses next to those lines. */
type Badge = "zero";

type IconSpec = { glyph: GlyphName; badge?: Badge };

/** Matched on the item name as it is stored, lowercased, so a staff edit to the casing or the
 *  surrounding whitespace does not drop the icon. Anything unmatched falls back to its category. */
const BY_ITEM: Record<string, IconSpec> = {
  // Vorspeise
  "brot mit alioli": { glyph: "bread_dip" },
  "brot mit chimichurri": { glyph: "bread_herb" },
  bruschetta: { glyph: "bruschetta" },
  provoleta: { glyph: "provoleta" },
  "tortilla de patatas": { glyph: "tortilla" },
  "serrano und käse platte": { glyph: "platter" },
  "tabla „la cordobesa“": { glyph: "board" },
  pommes: { glyph: "fries" },

  // Empanadas — the variants show their filling, since the heading already says empanada
  "empanada criolla": { glyph: "empanada" },
  "empanada de pollo": { glyph: "chicken_leg" },
  "empanada de espinaca y ricota": { glyph: "leaf" },
  "empanada de humita": { glyph: "corn" },
  "empanada caprese": { glyph: "tomato_basil" },
  "empanada de fugazzetta": { glyph: "onion" },
  "las tres empanadas": { glyph: "empanada_three" },

  // Hausgemachte Pasta
  "sorrentinos de espinaca y ricota": { glyph: "ravioli" },
  lasagna: { glyph: "lasagna" },

  // Clásico Argentino
  choripán: { glyph: "choripan" },

  // Pizzas — likewise the topping, not seven identical slices
  margherita: { glyph: "pizza" },
  prosciutto: { glyph: "ham" },
  "prosciutto funghi": { glyph: "mushroom" },
  salami: { glyph: "salami" },
  "4 quesos": { glyph: "cheese" },
  "parma, rúcula & schinken": { glyph: "rocket" },
  "extra burrata": { glyph: "burrata" },

  // Hauptgerichte
  "bife de chorizo (200 g)": { glyph: "steak" },
  "ojo de bife": { glyph: "steak_ribeye" },
  milanesa: { glyph: "cutlet" },
  "milanesa napolitana": { glyph: "cutlet_napoli" },

  // Desserts
  "flan con dulce de leche": { glyph: "flan" },
  tiramisú: { glyph: "tiramisu" },
  "tarta del día": { glyph: "cake_slice" },

  // Alkoholfreie Getränke
  "coca-cola / coca-cola zero / fanta / sprite": { glyph: "soda" },
  "agua con gas": { glyph: "water_sparkling" },
  "agua sin gas": { glyph: "water_still" },
  "jugo / zumo": { glyph: "juice" },

  // Alkoholische Getränke
  pils: { glyph: "beer_pils" },
  "pils alkoholfrei": { glyph: "beer_pils", badge: "zero" },
  "franziskaner weissbier": { glyph: "beer_wheat" },
  "franziskaner weissbier alkoholfrei": { glyph: "beer_wheat", badge: "zero" },
  "san miguel": { glyph: "beer_bottle" },
  "san miguel alkoholfrei": { glyph: "beer_bottle", badge: "zero" },

  // Heißgetränke
  americano: { glyph: "americano" },
  kaffee: { glyph: "coffee_cup" },
  espresso: { glyph: "espresso" },
  "espresso macchiato": { glyph: "espresso_macchiato" },
  "doppelter espresso": { glyph: "espresso_double" },
  cappuccino: { glyph: "cappuccino" },
  "latte macchiato": { glyph: "latte_glass" },
  "dekoffinierter kaffee": { glyph: "coffee_cup", badge: "zero" },
  "dekoffinierter cappuccino": { glyph: "cappuccino", badge: "zero" },
  "dekoffinierter latte macchiato": { glyph: "latte_glass", badge: "zero" },
  tee: { glyph: "tea" },
  eiskaffee: { glyph: "iced_coffee" },
  "heiße schokolade": { glyph: "hot_chocolate" },

  // Cocktails
  "aperol spritz": { glyph: "wine_orange" },
  "fernet con cola": { glyph: "highball" },
  "limoncello spritz": { glyph: "wine_lemon" },
  "campari orange": { glyph: "highball_orange" },
  negroni: { glyph: "rocks_ice" },
  "gin tonic": { glyph: "copa_lime" },
  lillét: { glyph: "wine_berry" },
  "la cordobesa": { glyph: "coupe_star" },
  "la cordobesa alkoholfrei": { glyph: "coupe_star", badge: "zero" },
  prosecco: { glyph: "flute" },
};

/** The glyph chosen for a dish, or null when it is not one of the items on the card. */
function menuIconFor(itemName: string): IconSpec | null {
  return BY_ITEM[itemName.trim().toLowerCase()] ?? null;
}

/** The badge needs room, so the dish shrinks towards the top-left and the stroke is scaled back up
 *  to keep the same weight as an unbadged icon beside it. The ring is knocked out of whatever is
 *  behind it; the card is cream, so set --menu-icon-bg anywhere the icon sits on another colour. */
const BADGED_SCALE = 0.78;

export function MenuItemIcon({
  itemName,
  categorySlug,
  size = 20,
}: {
  itemName: string;
  categorySlug: string;
  size?: number;
}) {
  const spec = menuIconFor(itemName);
  // A dish staff add later is not in the table above, so it falls back to the mark its column
  // already has on the home page rather than leaving the row short of an icon.
  if (!spec) return <MenuIcon slug={categorySlug} size={size} className="menu-icon" />;

  const glyph = GLYPHS[spec.glyph];

  return (
    <svg
      className="menu-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {spec.badge ? (
        <>
          <g transform={`scale(${BADGED_SCALE})`} strokeWidth={1.6 / BADGED_SCALE}>
            {glyph}
          </g>
          <circle cx="18" cy="18" r="5.2" fill="var(--menu-icon-bg, var(--cream))" stroke="none" />
          <circle cx="18" cy="18" r="4.1" />
          <path d="M20.9 15.1 15.1 20.9" />
        </>
      ) : (
        glyph
      )}
    </svg>
  );
}
