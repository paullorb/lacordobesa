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
import { INTL_LOCALE, LOCALES, localeHref, type Locale } from "@/lib/i18n";
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
    menuName: "Menü",
  },
  es: {
    description:
      "Especialidades argentinas caseras en Frankfurt am Main: empanadas, alfajores, tortas, pastas y platos a la parrilla.",
    cuisine: ["Argentina", "Sudamericana", "Pastelería"],
    menuName: "Menú",
  },
  en: {
    description:
      "Homemade Argentine specialities in Frankfurt am Main: empanadas, alfajores, cakes, pasta and dishes from the grill.",
    cuisine: ["Argentine", "South American", "Bakery"],
    menuName: "Menu",
  },
};

/** Absolute URL of a page in a language. The German home page is the site root, with no trailing slash. */
export const pageUrl = (locale: Locale, path: string) => {
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
/** `reservationsEnabled` is the Einstellungen switch: with online booking off the home page hides the form,
 *  so the graph must not keep advertising a reservation URL. */
/** `closures` are the shop's own closed dates (the `closures` table), published as special opening
 *  hours so a search result or an assistant does not send somebody to a locked door. */
export function restaurantJsonLd(
  hours: Tables<"opening_hours">[],
  locale: Locale = "de",
  reservationsEnabled = true,
  closures: string[] = [],
) {
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
    ...(reservationsEnabled ? { acceptsReservations: pageUrl(locale, "/#reservieren") } : {}),
    currenciesAccepted: "EUR",
    sameAs: [CONTACT.instagram, ...REVIEW_PLATFORMS.map((r) => r.url)],
    hasMap: CONTACT.mapsUrl,
    areaServed: { "@type": "City", name: "Frankfurt am Main" },
    openingHoursSpecification: openingHours(hours),
    // Google's documented way to say "closed all day": 00:00 to 00:00 on that one date.
    ...(closures.length
      ? {
          specialOpeningHoursSpecification: closures.map((date) => ({
            "@type": "OpeningHoursSpecification",
            opens: "00:00",
            closes: "00:00",
            validFrom: date,
            validThrough: date,
          })),
        }
      : {}),
    potentialAction: [
      ...(reservationsEnabled
        ? [{ "@type": "ReserveAction", target: { "@type": "EntryPoint", urlTemplate: pageUrl(locale, "/#reservieren"), inLanguage: INTL_LOCALE[locale] } }]
        : []),
      { "@type": "OrderAction", target: { "@type": "EntryPoint", urlTemplate: pageUrl(locale, "/vorbestellen"), inLanguage: INTL_LOCALE[locale] } },
    ],
  };
}

/** The site itself, pointing at the restaurant as its publisher. Search engines use it for the site
 *  name shown above a result; the language list tells an assistant which versions exist. */
export function websiteJsonLd(locale: Locale = "de") {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: "La Cordobesa",
    alternateName: "La Cordobesa Pastelería Argentina",
    url: pageUrl(locale, "/"),
    inLanguage: LOCALES.map((l) => INTL_LOCALE[l]),
    publisher: { "@id": `${SITE_URL}/#restaurant` },
  };
}

/** Home > page, for every public page below the home page. `name` is the page's own title. */
export function breadcrumbJsonLd(locale: Locale, path: string, name: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "La Cordobesa", item: pageUrl(locale, "/") },
      { "@type": "ListItem", position: 2, name, item: pageUrl(locale, path) },
    ],
  };
}

/** Questions and answers exactly as the page shows them. Google limits the FAQ rich result to a few
 *  kinds of site, but the markup is still what answer engines quote from, and it costs nothing. */
export function faqJsonLd(entries: { question: string; answer: string }[], locale: Locale = "de") {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: INTL_LOCALE[locale],
    mainEntity: entries.map((e) => ({
      "@type": "Question",
      name: e.question,
      acceptedAnswer: { "@type": "Answer", text: e.answer },
    })),
  };
}

/** The catering page as a Service the restaurant offers, one Offer per kind of celebration. */
export function cateringJsonLd(
  locale: Locale,
  copy: { title: string; description: string; ideas: readonly { title: string; text: string }[] },
) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${pageUrl(locale, "/catering")}#service`,
    serviceType: "Catering",
    name: copy.title,
    description: copy.description,
    url: pageUrl(locale, "/catering"),
    inLanguage: INTL_LOCALE[locale],
    provider: { "@id": `${SITE_URL}/#restaurant` },
    areaServed: { "@type": "City", name: "Frankfurt am Main" },
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: copy.title,
      itemListElement: copy.ideas.map((idea) => ({
        "@type": "Offer",
        itemOffered: { "@type": "Service", name: idea.title, description: idea.text },
      })),
    },
  };
}

/** The gallery as an ImageGallery, so image search and assistants can tie each photo to the place. */
export function galleryJsonLd(
  locale: Locale,
  name: string,
  photos: { url: string; caption: string | null }[],
) {
  return {
    "@context": "https://schema.org",
    "@type": "ImageGallery",
    name,
    url: pageUrl(locale, "/gallery"),
    about: { "@id": `${SITE_URL}/#restaurant` },
    image: photos.slice(0, 50).map((p) => ({
      "@type": "ImageObject",
      contentUrl: p.url,
      ...(p.caption ? { caption: p.caption } : {}),
    })),
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
    // Only where the content really is in that language. Section names and most descriptions are
    // written in German and only partly translated, so the es and en graphs claim no language
    // rather than a wrong one.
    ...(locale === "de" ? { inLanguage: INTL_LOCALE.de } : {}),
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
