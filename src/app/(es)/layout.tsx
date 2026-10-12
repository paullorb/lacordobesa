import type { Metadata } from "next";
import type { ReactNode } from "react";
import { RootDocument, rootMetadata } from "@/app/root-document";
import "@/app/globals.css";

/** Everything under `/es`. A separate root layout purely so `<html lang>` says es-AR. */
export const metadata: Metadata = rootMetadata("es");
export { viewport } from "@/app/root-document";

export default function SpanishLayout({ children }: { children: ReactNode }) {
  return <RootDocument locale="es">{children}</RootDocument>;
}
