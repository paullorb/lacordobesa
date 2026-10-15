/** schema.org JSON-LD for the public pages, built from the same data the pages render.
 *
 *  Google reads this to show opening hours, the address and a menu link directly in the
 *  search result. Everything here must therefore be true: a guessed coordinate or a wrong
 *  closing time is worse than leaving the property out, so optional facts we don't have are
 *  simply omitted until someone fills them in. */
import { LOGO } from "@/lib/brand";
import { CONTACT } from "@/lib/contact";
import type { MenuCategoryWithItems } from "@/lib/data";
import type { Tables } from "@/lib/database.types";
import { INTL_LOCALE, localeHref, type Locale } from "@/lib/i18n";
import { menuDescription } from "@/lib/menu-text";
import { REVIEW_PLATFORMS } from "@/lib/reviews";
import { SITE_URL } from "@/lib/site";

/** The few sentences of structured data that are prose. A `Record<Locale, ...>`, so a new language
 *  cannot be added without writing them. Dish names and descriptions come from the database; the
 *  descriptions follow the page's language with the same German fallback the page uses. */
const COPY: Record<Locale, { description: string; cuisine: string[]; menuName: string }> = {
  de: {
    description:
      "Hausgemachte argentinische Spezialitäten in Frankfurt am Main: Empanadas, Alfajores, Kuchen, Pasta und Gerichte vom Grill.",
    cuisine: ["Argentinisch", "Südamerikanisch", "Konditorei"],
    menuName: "Carta / Karte",
  },
  es: {
    description:
      "Especialidades argentinas caseras en Frankfurt am Main: empanadas, alfajores, tortas, pastas y platos a la parrilla.",
    cuisine: ["Argentina", "Sudamericana", "Pastelería"],
    menuName: "La carta",
  },
  en: {
    description:
      "Homemade Argentine specialities in Frankfurt am Main: empanadas, alfajores, cakes, pasta and dishes from the grill.",
    cuisine: ["Argentine", "South American", "Bakery"],
    menuName: "Menu",
  },
};

/** Absolute URL of a page in a language. The German home page is the site root, with no trailing slash. */
const pageUrl = (locale: Locale, path: string) => {
  const href = localeHref(locale, path);
  return href === "/" ? SITE_URL : `${SITE_URL}${href}`;
};

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

/** The business itself. Referenced by @id from the menu, so both graphs describe one place. The `@id`
 *  is the same in every language: it is one business, however many pages describe it. */
export function restaurantJsonLd(hours: Tables<"opening_hours">[], locale: Locale = "de") {
  return {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    "@id": `${SITE_URL}/#restaurant`,
    name: "La Cordobesa Pastelería Argentina",
    alternateName: CONTACT.name,
    description: COPY[locale].description,
    inLanguage: INTL_LOCALE[locale],
    url: pageUrl(locale, "/"),
    image: [`${SITE_URL}/assets/hero-pasteleria.jpg`],
    logo: `${SITE_URL}${LOGO.full}`,
    telephone: CONTACT.phoneE164,
    email: CONTACT.email,
    address: address(),
    // Google's own pin for the listing; OpenStreetMap puts the building within 5 m of it.
    geo: { "@type": "GeoCoordinates", latitude: 50.13793, longitude: 8.63912 },
    priceRange: "€€",
    servesCuisine: COPY[locale].cuisine,
    // hasMenu is the schema.org name; Google's LocalBusiness docs still read the older `menu`.
    hasMenu: pageUrl(locale, "/karte"),
    menu: pageUrl(locale, "/karte"),
    acceptsReservations: pageUrl(locale, "/#reservieren"),
    currenciesAccepted: "EUR",
    sameAs: [CONTACT.instagram, ...REVIEW_PLATFORMS.map((r) => r.url)],
    hasMap: CONTACT.mapsUrl,
    openingHoursSpecification: openingHours(hours),
  };
}

/** The carta as a schema.org Menu, one MenuSection per category. */
export function menuJsonLd(menu: MenuCategoryWithItems[], locale: Locale = "de") {
  return {
    "@context": "https://schema.org",
    "@type": "Menu",
    "@id": `${pageUrl(locale, "/karte")}#menu`,
    name: COPY[locale].menuName,
    url: pageUrl(locale, "/karte"),
    inLanguage: INTL_LOCALE[locale],
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
          ...(item.description || item.subtitle ? { description: menuDescription(item, locale) ?? item.subtitle } : {}),
          // price_label is free text ("ab 4,50 €"), which schema.org's `price` rejects; `offers.description`
          // keeps the information without claiming a machine-readable amount.
          ...(item.price_label ? { offers: { "@type": "Offer", description: item.price_label, priceCurrency: "EUR" } } : {}),
        })),
      })),
  };
}
