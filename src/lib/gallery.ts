export const GALLERY_CATEGORIES = [
  { value: "venue", label: "Lokal" },
  { value: "food", label: "Essen" },
  { value: "events", label: "Events" },
] as const;

export type GalleryCategory = (typeof GALLERY_CATEGORIES)[number]["value"];

export const isGalleryCategory = (v: string): v is GalleryCategory => GALLERY_CATEGORIES.some((c) => c.value === v);

export const categoryLabel = (v: string) => GALLERY_CATEGORIES.find((c) => c.value === v)?.label ?? v;

export const GALLERY_MAX_BYTES = 5 * 1024 * 1024;
export const GALLERY_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
