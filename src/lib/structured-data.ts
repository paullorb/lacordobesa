/** schema.org JSON-LD for the public pages, built from the same data the pages render.
 *
 *  Google reads this to show opening hours, the address and a menu link directly in the
 *  search result. Everything here must therefore be true: a guessed coordinate or a wrong
 *  closing time is worse than leaving the property out, so optional facts we don't have
 *  (geo, priceRange) are simply omitted until someone fills them in. */
import { ALLERGENS, type AllergenCode } from "@/lib/allergens";
import { CONTACT } from "@/lib/contact";
import type { MenuCategoryWithItems } from "@/lib/data";
import type { Tables } from "@/lib/database.types";
import { SITE_URL } from "@/lib/site";

/** schema.org expects the English day names; opening_hours.weekday is 0 = Sunday. */
const SCHEMA_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "60431 Frankfurt am Main" -> { postalCode: "60431", city: "Frankfurt am Main" } */
function splitCity(city: string) {
  const m = /^(\d{5})\s+(.*)$/.exec(city.trim());
  return m ? { postalCode: m[1], city: m[2] } : { postalCode: undefined, city: city.trim() };
}

function address() {
  const { postalCode, city } = splitCity(CONTACT.city);
  return {
    "@type": "PostalAddress",
    streetAddress: CONTACT.street,
    postalCode,
    addressLocality: city,
    addressCountry: "DE",
  };
}

function openingHours(hours: Tables<"opening_hours">[]) {
  return hours
    .filter((h) => !h.is_closed && h.opens && h.closes)
    .map((h) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: `https://schema.org/${SCHEMA_DAYS[h.weekday]}`,
      // "09:00:00" -> "09:00"; not fmtTime() from data.ts, which is server-only.
      opens: h.opens!.slice(0, 5),
      closes: h.closes!.slice(0, 5),
    }));
}

/** The business itself. Referenced by @id from the menu, so both graphs describe one place. */
export function restaurantJsonLd(hours: Tables<"opening_hours">[]) {
  return {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    "@id": `${SITE_URL}/#restaurant`,
    name: "La Cordobesa Pastelería Argentina",
    alternateName: CONTACT.name,
    description:
      "Hausgemachte argentinische Spezialitäten in Frankfurt am Main: Empanadas, Alfajores, Kuchen, Pasta und Gerichte vom Grill.",
    url: SITE_URL,
    image: [`${SITE_URL}/assets/hero-pasteleria.jpg`],
    logo: `${SITE_URL}/assets/logo.svg`,
    telephone: CONTACT.phoneE164,
    email: CONTACT.email,
    address: address(),
    servesCuisine: ["Argentinisch", "Südamerikanisch", "Konditorei"],
    hasMenu: `${SITE_URL}/karte`,
    acceptsReservations: `${SITE_URL}/#reservieren`,
    currenciesAccepted: "EUR",
    sameAs: [CONTACT.instagram],
    hasMap: CONTACT.mapsUrl,
    openingHoursSpecification: openingHours(hours),
  };
}

/** "Enthält: Eier, Milch und Laktose" for the dishes that declare allergens. */
function allergenNote(codes: string[] | null | undefined) {
  const labels = (codes ?? []).filter((c): c is AllergenCode => c in ALLERGENS).map((c) => ALLERGENS[c]);
  return labels.length > 0 ? `Enthält: ${labels.join(", ")}` : null;
}

/** The carta as a schema.org Menu, one MenuSection per category. */
export function menuJsonLd(menu: MenuCategoryWithItems[]) {
  return {
    "@context": "https://schema.org",
    "@type": "Menu",
    "@id": `${SITE_URL}/karte#menu`,
    name: "Carta / Karte",
    url: `${SITE_URL}/karte`,
    inLanguage: "de-DE",
    provider: { "@id": `${SITE_URL}/#restaurant` },
    hasMenuSection: menu
      .filter((c) => c.items.length > 0)
      .map((c) => ({
        "@type": "MenuSection",
        name: c.label,
        ...(c.note ? { description: c.note } : {}),
        hasMenuItem: c.items.map((item) => ({
          "@type": "MenuItem",
          name: item.name,
          ...(item.description || item.subtitle ? { description: item.description ?? item.subtitle } : {}),
          // price_label is free text ("ab 4,50 €"), which schema.org's `price` rejects; `offers.description`
          // keeps the information without claiming a machine-readable amount.
          ...(item.price_label ? { offers: { "@type": "Offer", description: item.price_label, priceCurrency: "EUR" } } : {}),
          // schema.org has no allergen vocabulary, so the declared allergens go in as a restriction-free
          // suitableForDiet-style note: a plain German list Google can show but not misinterpret.
          ...(allergenNote(item.allergens) ? { nutrition: { "@type": "NutritionInformation", description: allergenNote(item.allergens) } } : {}),
        })),
      })),
  };
}
