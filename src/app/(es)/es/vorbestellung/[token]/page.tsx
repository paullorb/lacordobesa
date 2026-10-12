// Guest pre-order page in Spanish. A wrapper, not a page: the implementation is the shared view, and this file
// exists only to bind it to a URL and a locale.
//
// An explicit `(es)/es` tree rather than one dynamic `[locale]` segment. The segment
// worked, but reading the locale out of `params` meant awaiting runtime-shaped data in the page
// body, which costs the prefetchable shell that `partialPrefetching` exists to provide. With the
// locale as a literal there is nothing to await: the page prerenders and the navigation stays
// instant. See src/lib/i18n.ts.
import type { Metadata } from "next";
import { ManagePreorderView } from "@/components/pages/manage-preorder-view";
import { tokenPageMetadata } from "@/lib/page-metadata";

export const metadata: Metadata = tokenPageMetadata("es", (d) => d.managePreorder.title);

export default function Page(props: PageProps<"/es/vorbestellung/[token]">) {
  return <ManagePreorderView locale="es" params={props.params} />;
}
