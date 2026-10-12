import type { Metadata } from "next";
import { MENU_PATH, MenuView } from "@/components/pages/menu-view";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata: Metadata = pageMetadata("de", MENU_PATH, (d) => d.menuPage);

export default function Page() {
  return <MenuView locale="de" />;
}
