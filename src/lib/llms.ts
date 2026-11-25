/** The text served at /llms.txt: the whole shop on one plain page, for language models.
 *
 *  llms.txt (llmstxt.org) is a Markdown file at the site root that tells an assistant what a site is
 *  and where the useful pages are, without making it parse a React page. This site is small enough
 *  to put the facts themselves in it: address, hours, how to book, and the menu with its prices.
 *
 *  Written in English, the language every assistant handles, with links to all three languages of
 *  each page. Built from the same cached reads the pages render, and the questions come from
 *  lib/faq.ts, so this file cannot say anything the site does not. */
import { CONTACT } from "@/lib/contact";
import type { MenuCategoryWithItems } from "@/lib/data";
import type { Tables } from "@/lib/database.types";
import { faqEntries } from "@/lib/faq";
import { LOCALE_NAME, LOCALES, localeHref } from "@/lib/i18n";
import { menuDescription } from "@/lib/menu-text";
import { REVIEW_PLATFORMS } from "@/lib/reviews";
import { SITE_URL } from "@/lib/site";

const url = (href: string) => `${SITE_URL}${href === "/" ? "" : href}`;

/** "[Deutsch](…/karte) · [Español](…/es/karte) · [English](…/en/karte)" */
const inEveryLanguage = (path: string) =>
  LOCALES.map((locale) => `[${LOCALE_NAME[locale]}](${url(localeHref(locale, path))})`).join(" · ");

/** Markdown would read a stray `*` or `_` in a dish name as emphasis. */
const plain = (text: string) => text.replace(/\s+/g, " ").replace(/([*_`[\]])/g, "\\$1").trim();

export function llmsTxt({
  hours,
  menu,
  closures,
  reservationsEnabled,
  preordersEnabled,
}: {
  hours: Tables<"opening_hours">[];
  menu: MenuCategoryWithItems[];
  closures: string[];
  reservationsEnabled: boolean;
  preordersEnabled: boolean;
}): string {
  const faq = faqEntries("en", { hours, reservationsEnabled, preordersEnabled });
  const lines: string[] = [
    "# La Cordobesa",
    "",
    "> La Cordobesa is a family-run Argentine restaurant and bakery (pastelería argentina) in Frankfurt am Main, Germany. " +
      "Everything is homemade: empanadas, alfajores, cakes and pastelitos, pasta and dishes from the grill. " +
      "The family comes from Alta Gracia in the province of Córdoba, Argentina.",
    "",
    "## Key facts",
    "",
    `- Name: La Cordobesa (Pastelería Argentina)`,
    `- Address: ${CONTACT.street}, ${CONTACT.city}, Germany`,
    `- Phone and WhatsApp: ${CONTACT.phoneDisplay}`,
    `- Email: ${CONTACT.email}`,
    `- Instagram: ${CONTACT.instagram}`,
    `- Map: ${CONTACT.mapsUrl}`,
    `- Cuisine: Argentine, South American, bakery`,
    `- Price range: €€`,
    `- Website languages: German (default), Spanish, English`,
    ...faq.filter((e) => e.id === "oeffnungszeiten").map((e) => `- Opening hours: ${e.answer}`),
    ...(closures.length ? [`- Closed on: ${closures.join(", ")}`] : []),
    "",
    "## Pages",
    "",
    `- Home, with opening hours, directions${reservationsEnabled ? " and online table reservation" : ""}: ${inEveryLanguage("/")}`,
    `- Menu: ${inEveryLanguage("/karte")}`,
    `- Pre-order for pickup: ${inEveryLanguage("/vorbestellen")}`,
    `- Celebrations and catering: ${inEveryLanguage("/catering")}`,
    `- Photo gallery: ${inEveryLanguage("/gallery")}`,
    "",
    "## Questions and answers",
    "",
    ...faq.flatMap((e) => [`### ${e.question}`, "", e.answer, ""]),
    "## Menu",
    "",
    "Dish names are the Argentine names used in the shop. Prices in euros, as listed on the menu page. " +
      "For allergies or intolerances, guests are asked to speak to the staff.",
    "",
  ];

  for (const category of menu.filter((c) => c.items.length > 0)) {
    lines.push(`### ${plain(category.label)}`, "");
    if (category.note) lines.push(plain(category.note), "");
    for (const item of category.items) {
      const description = menuDescription(item, "en") ?? item.subtitle;
      const price = item.price_label ? ` (${plain(item.price_label)})` : "";
      lines.push(`- ${plain(item.name)}${price}${description ? `: ${plain(description)}` : ""}`);
    }
    lines.push("");
  }

  lines.push(
    "## Reviews",
    "",
    "Independent ratings of La Cordobesa:",
    "",
    ...REVIEW_PLATFORMS.map((p) => `- [${p.name}](${p.url})`),
    "",
  );
  return lines.join("\n");
}
