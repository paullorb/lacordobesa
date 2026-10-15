import { APPS, webManifest } from "@/lib/brand";

// The staff app's own manifest: its name, its /staff scope and start page, and a cream tile.
//
// It lives at /staff.webmanifest and not under /staff/ on purpose. The session proxy guards every
// /staff/ path, and a browser fetches a manifest without cookies, so a manifest inside that prefix
// would be answered with the login redirect and the app would never be offered for install.

export function GET() {
  return Response.json(webManifest(APPS.staff), {
    headers: { "Content-Type": "application/manifest+json" },
  });
}
