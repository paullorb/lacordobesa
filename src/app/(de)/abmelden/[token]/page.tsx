import type { Metadata } from "next";
import { UnsubscribeView } from "@/components/pages/unsubscribe-view";
import { tokenPageMetadata } from "@/lib/page-metadata";

export const metadata: Metadata = tokenPageMetadata("de", (d) => d.unsubscribe.title);

export default function Page(props: PageProps<"/abmelden/[token]">) {
  return <UnsubscribeView locale="de" params={props.params} />;
}
