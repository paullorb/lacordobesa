import type { Metadata } from "next";
import { PREORDER_PATH, PreorderView } from "@/components/pages/preorder-view";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata: Metadata = pageMetadata("de", PREORDER_PATH, (d) => d.preorderPage);

export default function Page() {
  return <PreorderView locale="de" />;
}
