import type { Metadata } from "next";
import { ManageReservationView } from "@/components/pages/manage-reservation-view";
import { tokenPageMetadata } from "@/lib/page-metadata";

export const metadata: Metadata = tokenPageMetadata("de", (d) => d.manage.title);

export default function Page(props: PageProps<"/reservierung/[token]">) {
  return <ManageReservationView locale="de" params={props.params} />;
}
