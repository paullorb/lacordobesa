import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DM_Sans, Playfair_Display } from "next/font/google";
import { RootDocument, rootMetadata } from "@/app/root-document";
import "@/app/globals.css";

// Self-hosted at build time, so no request goes to Google Fonts from the visitor's browser. See
// root-document.tsx for why this is declared here rather than shared across root layouts.
const sans = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-sans" });
const serif = Playfair_Display({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-serif",
});

/** Everything under `/en`. A separate root layout purely so `<html lang>` says en-GB. */
export const metadata: Metadata = rootMetadata("en");
export { viewport } from "@/app/root-document";

export default function EnglishLayout({ children }: { children: ReactNode }) {
  return (
    <RootDocument locale="en" fontVariables={`${sans.variable} ${serif.variable}`}>
      {children}
    </RootDocument>
  );
}
