// Celebrations and catering in Spanish. A wrapper, not a page: the implementation is the shared view, and this file
// exists only to bind it to a URL and a locale.
//
// Explicit `app/es` and `app/en` trees rather than one dynamic `[locale]` segment. The segment
// worked, but reading the locale out of `params` meant awaiting runtime-shaped data in the page
// body, which costs the prefetchable shell that `partialPrefetching` exists to provide. With the
// locale as a literal there is nothing to await: the page prerenders and the navigation stays
// instant. See src/lib/i18n.ts.
import type { Metadata } from "next";
import { CATERING_PATH, CateringView } from "@/components/pages/catering-view";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata: Metadata = pageMetadata("es", CATERING_PATH, (d) => d.cateringPage);

export default function Page() {
  return <CateringView locale="es" />;
}
