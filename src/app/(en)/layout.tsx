import type { Metadata } from "next";
import type { ReactNode } from "react";
import { RootDocument, rootMetadata } from "@/app/root-document";
import "@/app/globals.css";

/** Everything under `/en`. A separate root layout purely so `<html lang>` says en-GB. */
export const metadata: Metadata = rootMetadata("en");
export { viewport } from "@/app/root-document";

export default function EnglishLayout({ children }: { children: ReactNode }) {
  return <RootDocument locale="en">{children}</RootDocument>;
}
