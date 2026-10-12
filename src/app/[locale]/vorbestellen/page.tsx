import type { Metadata } from "next";
import { PREORDER_PATH, PreorderView } from "@/components/pages/preorder-view";
import { localeFromParams, pageMetadata } from "@/lib/page-metadata";

export async function generateMetadata(props: PageProps<"/[locale]/vorbestellen">): Promise<Metadata> {
  return pageMetadata(await localeFromParams(props.params), PREORDER_PATH, (d) => d.preorderPage);
}

export default async function Page(props: PageProps<"/[locale]/vorbestellen">) {
  return <PreorderView locale={await localeFromParams(props.params)} />;
}
