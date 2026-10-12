import type { Metadata } from "next";
import { GALLERY_PATH, GalleryView } from "@/components/pages/gallery-view";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata: Metadata = pageMetadata("de", GALLERY_PATH, (d) => d.galleryPage);

export default function GalleryPage() {
  return <GalleryView locale="de" />;
}
