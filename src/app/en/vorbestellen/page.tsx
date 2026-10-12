// Pre-orders in English. A wrapper, not a page: the implementation is the shared view, and this file
// exists only to bind it to a URL and a locale.
//
// Explicit `app/es` and `app/en` trees rather than one dynamic `[locale]` segment. The segment
// worked, but reading the locale out of `params` meant awaiting runtime-shaped data in the page
// body, which costs the prefetchable shell that `partialPrefetching` exists to provide. With the
// locale as a literal there is nothing to await: the page prerenders and the navigation stays
// instant. See src/lib/i18n.ts.
import type { Metadata } from "next";
import { PREORDER_PATH, PreorderView } from "@/components/pages/preorder-view";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata: Metadata = pageMetadata("en", PREORDER_PATH, (d) => d.preorderPage);

export default function Page() {
  return <PreorderView locale="en" />;
}
