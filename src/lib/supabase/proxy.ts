import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Refreshes the Supabase session cookie once per navigation and guards /admin. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
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

  // getUser() validates the JWT against Supabase; getSession() would trust the cookie blindly.
  const {
    data: { user: sessionUser },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isLogin = pathname === "/admin/login";

  // Signed in but not on the staff allowlist (public.staff): drop the session so the user
  // cannot sit in a half-authenticated state, then send them to the login page.
  let user = sessionUser;
  if (user) {
    const { data: isStaff } = await supabase.rpc("is_staff");
    if (!isStaff) {
      await supabase.auth.signOut();
      user = null;
      if (!isLogin) {
        const url = request.nextUrl.clone();
        url.pathname = "/admin/login";
        url.search = "?fehler=kein-zugang";
        return NextResponse.redirect(url);
      }
    }
  }

  if (!user && pathname.startsWith("/admin") && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (user && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
