import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/env";

/** Refreshes the Supabase session cookie once per navigation and guards /staff. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    supabaseUrl(),
    supabasePublishableKey(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // getClaims() verifies the JWT's signature (locally, against the project's published ES256 key) and
  // refreshes an expired session; getSession() would trust the cookie blindly. getUser() did the
  // same check as a round trip to the Auth server on every navigation.
  const { data: claimsData } = await supabase.auth.getClaims();
  const sessionUser = claimsData?.claims?.sub ? { id: claimsData.claims.sub } : null;

  const { pathname } = request.nextUrl;
  const isLogin = pathname === "/staff/login";

  // Signed in but not on the staff allowlist (public.staff): drop the session so the user
  // cannot sit in a half-authenticated state, then send them to the login page.
  let user = sessionUser;
  if (user) {
    const { data: isStaff, error } = await supabase.rpc("is_staff");
    if (error) {
      // The allowlist check itself failed. Fail closed, but keep the session: signing the whole
      // team out over a backend blip is worse than making them retry. Leaving them on the login
      // page rather than bouncing them to /staff below is what keeps this from looping.
      if (isLogin) return response;
      const url = request.nextUrl.clone();
      url.pathname = "/staff/login";
      url.search = "?fehler=pruefung-fehlgeschlagen";
      return NextResponse.redirect(url);
    }
    if (!isStaff) {
      await supabase.auth.signOut();
      user = null;
      if (!isLogin) {
        const url = request.nextUrl.clone();
        url.pathname = "/staff/login";
        url.search = "?fehler=kein-zugang";
        return NextResponse.redirect(url);
      }
    }
  }

  if (!user && pathname.startsWith("/staff") && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/staff/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (user && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/staff";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
