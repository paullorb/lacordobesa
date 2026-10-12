import type { MetadataRoute } from "next";

// Installable staff app: opens straight into the admin.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "La Cordobesa — Team",
    short_name: "Cordobesa",
    description: "Reservierungen, Karte und Öffnungszeiten verwalten.",
    start_url: "/admin",
    scope: "/",
    display: "standalone",
    background_color: "#f7f5f0",
    theme_color: "#152f3b",
    lang: "de",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
