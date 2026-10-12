import type { Metadata } from "next";
import { GALLERY_PATH, GalleryView } from "@/components/pages/gallery-view";
import { localeFromParams, pageMetadata } from "@/lib/page-metadata";

export async function generateMetadata(props: PageProps<"/[locale]/gallery">): Promise<Metadata> {
  return pageMetadata(await localeFromParams(props.params), GALLERY_PATH, (d) => d.galleryPage);
}

export default async function Page(props: PageProps<"/[locale]/gallery">) {
  return <GalleryView locale={await localeFromParams(props.params)} />;
}
