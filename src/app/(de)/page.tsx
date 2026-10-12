import type { Metadata } from "next";
import { HOME_PATH, HomeView } from "@/components/pages/home-view";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata: Metadata = pageMetadata("de", HOME_PATH, (d) => d.home);

export default function Page() {
  return <HomeView locale="de" />;
}
