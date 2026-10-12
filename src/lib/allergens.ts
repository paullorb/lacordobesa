/** The codes a German menu has to declare, with the labels for the legend.
 *
 *  Allergens: the 14 of EU regulation 1169/2011 (LMIV), Anhang II, lettered a..n in the order the
 *  regulation lists them. Additives: the classes a Gaststätte declares under the
 *  Zusatzstoff-Zulassungsverordnung, numbered the way German menus traditionally number them.
 *
 *  The same codes are constrained in the database (migration 20261012093136), so these lists and the
 *  check constraints have to stay in step. */
import type { Locale } from "@/lib/i18n";

export const ALLERGENS = {
  a: "Glutenhaltiges Getreide",
  b: "Krebstiere",
  c: "Eier",
  d: "Fische",
  e: "Erdnüsse",
  f: "Sojabohnen",
  g: "Milch und Laktose",
  h: "Schalenfrüchte (Nüsse)",
  i: "Sellerie",
  j: "Senf",
  k: "Sesamsamen",
  l: "Schwefeldioxid und Sulphite",
  m: "Lupinen",
  n: "Weichtiere",
} as const;

export const ADDITIVES = {
  "1": "mit Farbstoff",
  "2": "mit Konservierungsstoff",
  "3": "mit Antioxidationsmittel",
  "4": "mit Geschmacksverstärker",
  "5": "geschwefelt",
  "6": "geschwärzt",
  "7": "gewachst",
  "8": "mit Phosphat",
  "9": "mit Süßungsmittel",
  "10": "enthält eine Phenylalaninquelle",
  "11": "mit Taurin",
  "12": "koffeinhaltig",
  "13": "chininhaltig",
} as const;

/** The same codes in Spanish, the site's other language. Allergen names are regulated terms, so a
 *  guest reading the Spanish menu needs them in Spanish; the codes themselves are language-independent. */
const ALLERGENS_ES: Record<keyof typeof ALLERGENS, string> = {
  a: "Cereales con gluten",
  b: "Crustáceos",
  c: "Huevos",
  d: "Pescado",
  e: "Maní",
  f: "Soja",
  g: "Leche y lactosa",
  h: "Frutos secos",
  i: "Apio",
  j: "Mostaza",
  k: "Sésamo",
  l: "Dióxido de azufre y sulfitos",
  m: "Altramuces",
  n: "Moluscos",
};

const ADDITIVES_ES: Record<keyof typeof ADDITIVES, string> = {
  "1": "con colorante",
  "2": "con conservante",
  "3": "con antioxidante",
  "4": "con potenciador del sabor",
  "5": "sulfitado",
  "6": "con ennegrecedor",
  "7": "encerado",
  "8": "con fosfato",
  "9": "con edulcorante",
  "10": "contiene una fuente de fenilalanina",
  "11": "con taurina",
  "12": "con cafeína",
  "13": "con quinina",
};

export const ALLERGEN_LABELS: Record<Locale, Record<keyof typeof ALLERGENS, string>> = {
  de: ALLERGENS,
  es: ALLERGENS_ES,
};

export const ADDITIVE_LABELS: Record<Locale, Record<keyof typeof ADDITIVES, string>> = {
  de: ADDITIVES,
  es: ADDITIVES_ES,
};

export type AllergenCode = keyof typeof ALLERGENS;
export type AdditiveCode = keyof typeof ADDITIVES;

export const ALLERGEN_CODES = Object.keys(ALLERGENS) as AllergenCode[];
/** Numeric order, not the lexicographic order Object.keys would give for "10" vs "2". */
export const ADDITIVE_CODES = (Object.keys(ADDITIVES) as AdditiveCode[]).sort((a, b) => Number(a) - Number(b));

export const isAllergenCode = (c: string): c is AllergenCode => c in ALLERGENS;
export const isAdditiveCode = (c: string): c is AdditiveCode => c in ADDITIVES;

/** Keeps only known codes, de-duplicates and sorts them, so a hand-crafted POST cannot smuggle
 *  an unlabelled code past the form. The database constraint is the backstop. */
export function cleanAllergens(values: string[]): AllergenCode[] {
  return ALLERGEN_CODES.filter((c) => values.includes(c));
}

export function cleanAdditives(values: string[]): AdditiveCode[] {
  return ADDITIVE_CODES.filter((c) => values.includes(c));
}

/** "a, c, g" for the superscript next to a dish. */
export const codeList = (codes: readonly string[]) => codes.join(", ");

/** Legend entries for exactly the codes used on a page, in regulation order, in one language. */
export function legendFor(allergens: readonly string[], additives: readonly string[], locale: Locale) {
  return [
    ...ALLERGEN_CODES.filter((c) => allergens.includes(c)).map((c) => ({ code: c, label: ALLERGEN_LABELS[locale][c] })),
    ...ADDITIVE_CODES.filter((c) => additives.includes(c)).map((c) => ({ code: c, label: ADDITIVE_LABELS[locale][c] })),
  ];
}
