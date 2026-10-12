import type { Metadata, Viewport } from "next";
import { DM_Sans, Playfair_Display } from "next/font/google";
import "./globals.css";

// Self-hosted at build time, so no request goes to Google Fonts from the visitor's browser.
const sans = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-sans" });
const serif = Playfair_Display({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-serif",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "La Cordobesa — Ein Stück Argentinien in Frankfurt", template: "%s · La Cordobesa" },
  description:
    "Hausgemachte argentinische Spezialitäten in Frankfurt: Empanadas, Alfajores, Kuchen und mehr. Mit Liebe gemacht bei La Cordobesa.",
  icons: { icon: "/assets/favicon.svg", apple: "/icons/apple-touch-icon.png" },
  openGraph: {
    title: "La Cordobesa — Ein Stück Argentinien in Frankfurt",
    description: "Hausgemacht, authentisch und mit viel Liebe. Entdecke argentinische Spezialitäten in Frankfurt am Main.",
    images: ["/assets/hero-pasteleria.jpg"],
    locale: "de_DE",
    type: "website",
  },
};

export const viewport: Viewport = { themeColor: "#f5f1e9" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de" className={`${sans.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
