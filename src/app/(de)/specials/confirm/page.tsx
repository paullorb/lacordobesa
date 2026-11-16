import type { Metadata } from "next";
import { SpecialsConfirmView } from "@/components/pages/specials-confirm-view";
import { getDictionary } from "@/lib/dictionaries";

export const metadata: Metadata = {
  title: getDictionary("de").specialsConfirm.pageTitle,
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function Page(props: PageProps<"/specials/confirm">) {
  return <SpecialsConfirmView locale="de" searchParams={props.searchParams} />;
}
