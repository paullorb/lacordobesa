import type { MetadataRoute } from "next";
import { APPS, webManifest } from "@/lib/brand";

// The public site as a home-screen shortcut. The staff app has its own manifest (see
// `staff.webmanifest/route.ts`) so that installing one never replaces the other.
export default function manifest(): MetadataRoute.Manifest {
  return webManifest(APPS.public);
}
