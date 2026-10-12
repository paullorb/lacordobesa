import type { Metadata } from "next";
import { ManagePreorderView } from "@/components/pages/manage-preorder-view";
import { tokenPageMetadata } from "@/lib/page-metadata";

export const metadata: Metadata = tokenPageMetadata("de", (d) => d.managePreorder.title);

export default function Page(props: PageProps<"/vorbestellung/[token]">) {
  return <ManagePreorderView locale="de" params={props.params} />;
}
