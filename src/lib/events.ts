/** Occasions and budget bands are constrained in the database (migration 20261012095610), so these
 *  lists and the check constraints have to stay in step. Order is the order the form offers them. */
export const OCCASIONS = {
  geburtstag: "Geburtstag / Cumpleaños",
  firmenfeier: "Firmenfeier",
  taufe: "Taufe oder Kommunion",
  hochzeit: "Hochzeit",
  catering: "Catering zum Abholen oder Liefern",
  andere: "Etwas anderes",
} as const;

export const BUDGET_BANDS = {
  unsicher: "Noch unklar",
  "bis-500": "bis 500 €",
  "500-1000": "500 bis 1.000 €",
  "1000-2500": "1.000 bis 2.500 €",
  "ueber-2500": "mehr als 2.500 €",
} as const;

export type Occasion = keyof typeof OCCASIONS;
export type BudgetBand = keyof typeof BUDGET_BANDS;

export const OCCASION_CODES = Object.keys(OCCASIONS) as Occasion[];
export const BUDGET_CODES = Object.keys(BUDGET_BANDS) as BudgetBand[];

export const isOccasion = (v: string): v is Occasion => v in OCCASIONS;
export const isBudgetBand = (v: string): v is BudgetBand => v in BUDGET_BANDS;

/** Labels for a stored value, falling back to the raw code so an older row never renders blank. */
export const occasionLabel = (v: string) => (isOccasion(v) ? OCCASIONS[v] : v);
export const budgetLabel = (v: string) => (isBudgetBand(v) ? BUDGET_BANDS[v] : v);
