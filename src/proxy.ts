import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  // The service worker precaches this page while logged out. Behind the login redirect it would
  // cache the login page as the offline fallback. It holds no data, so it needs no session.
  if (request.nextUrl.pathname === "/staff/offline") return NextResponse.next();
  return updateSession(request);
}

export const config = {
  // Only the staff area needs a session; the public site stays fully static.
  matcher: ["/staff/:path*"],
};
