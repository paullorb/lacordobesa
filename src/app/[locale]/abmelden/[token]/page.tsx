import type { Metadata } from "next";
import { Suspense } from "react";
import { UnsubscribeView } from "@/components/pages/unsubscribe-view";
import { localeFromParams, tokenPageMetadata } from "@/lib/page-metadata";

export async function generateMetadata(props: PageProps<"/[locale]/abmelden/[token]">): Promise<Metadata> {
  return tokenPageMetadata(await localeFromParams(props.params), (d) => d.unsubscribe.title);
}

/**
 * The locale lives in the same `params` object as the token, and the token is runtime data, so
 * awaiting it to read the locale would stop the route prerendering entirely. Resolving it inside a
 * boundary keeps that cost where it belongs: these pages are per-request and `noindex` anyway.
 */
export default function Page(props: PageProps<"/[locale]/abmelden/[token]">) {
  return (
    <Suspense fallback={null}>
      <Resolved params={props.params} />
    </Suspense>
  );
}

async function Resolved({ params }: { params: PageProps<"/[locale]/abmelden/[token]">["params"] }) {
  return <UnsubscribeView locale={await localeFromParams(params)} params={params} />;
}
