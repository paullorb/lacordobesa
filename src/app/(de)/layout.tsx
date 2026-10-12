import type { Metadata } from "next";
import type { ReactNode } from "react";
import { RootDocument, rootMetadata } from "@/app/root-document";
import "@/app/globals.css";

/** German is the unprefixed language, so this group owns `/`, the legal pages and `/staff`. */
export const metadata: Metadata = rootMetadata("de");
export { viewport } from "@/app/root-document";

export default function GermanLayout({ children }: { children: ReactNode }) {
  return <RootDocument locale="de">{children}</RootDocument>;
}
