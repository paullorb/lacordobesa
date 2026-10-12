import type { Metadata } from "next";
import { CATERING_PATH, CateringView } from "@/components/pages/catering-view";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata: Metadata = pageMetadata("de", CATERING_PATH, (d) => d.cateringPage);

export default function Page() {
  return <CateringView locale="de" />;
}
