import type { Metadata } from "next";
import { CATERING_PATH, CateringView } from "@/components/pages/catering-view";
import { localeFromParams, pageMetadata } from "@/lib/page-metadata";

export async function generateMetadata(props: PageProps<"/[locale]/catering">): Promise<Metadata> {
  return pageMetadata(await localeFromParams(props.params), CATERING_PATH, (d) => d.cateringPage);
}

export default async function Page(props: PageProps<"/[locale]/catering">) {
  return <CateringView locale={await localeFromParams(props.params)} />;
}
