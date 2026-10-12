import type { Metadata } from "next";
import { MENU_PATH, MenuView } from "@/components/pages/menu-view";
import { localeFromParams, pageMetadata } from "@/lib/page-metadata";

export async function generateMetadata(props: PageProps<"/[locale]/karte">): Promise<Metadata> {
  return pageMetadata(await localeFromParams(props.params), MENU_PATH, (d) => d.menuPage);
}

export default async function Page(props: PageProps<"/[locale]/karte">) {
  return <MenuView locale={await localeFromParams(props.params)} />;
}
