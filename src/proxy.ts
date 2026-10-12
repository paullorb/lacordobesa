import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Only the staff area needs a session; the public site stays fully static.
  matcher: ["/admin/:path*"],
};
