// Spanish confirmation page of the specials e-mail sign-up: a wrapper binding the shared view to a URL
// and a locale (see ../../abmelden/[token]/page.tsx for why the locale trees are explicit).
import type { Metadata } from "next";
import { SpecialsConfirmView } from "@/components/pages/specials-confirm-view";
import { tokenPageMetadata } from "@/lib/page-metadata";

export const metadata: Metadata = tokenPageMetadata("es", (d) => d.specialsConfirm.pageTitle);

export default function Page(props: PageProps<"/es/specials/confirm">) {
  return <SpecialsConfirmView locale="es" searchParams={props.searchParams} />;
}
