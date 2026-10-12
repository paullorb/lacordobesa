import type { Metadata } from "next";
import { HOME_PATH, HomeView } from "@/components/pages/home-view";
import { localeFromParams, pageMetadata } from "@/lib/page-metadata";

export async function generateMetadata(props: PageProps<"/[locale]">): Promise<Metadata> {
  return pageMetadata(await localeFromParams(props.params), HOME_PATH, (d) => d.home);
}

export default async function Page(props: PageProps<"/[locale]">) {
  return <HomeView locale={await localeFromParams(props.params)} />;
}
