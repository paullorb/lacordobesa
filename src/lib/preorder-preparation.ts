/** How empanadas leave the shop: baked for collection, or par-baked to be kept in the guest's freezer.
 *  Client-safe (no server-only), because the wizard, the Server Action and the staff card all use it. */
export const PREPARATIONS = ["fresh", "frozen"] as const;
export type Preparation = (typeof PREPARATIONS)[number];

export const isPreparation = (value: unknown): value is Preparation =>
  typeof value === "string" && (PREPARATIONS as readonly string[]).includes(value);

/** The category slug the choice applies to. request_preorder() decides by the same slug. */
export const EMPANADA_SLUG = "empanadas";

/** Staff-facing labels (the staff UI is German only). */
export const PREPARATION_STAFF_LABEL: Record<Preparation, string> = {
  fresh: "Frisch",
  frozen: "Tiefgekühlt",
};
