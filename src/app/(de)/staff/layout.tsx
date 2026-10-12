import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { RegisterServiceWorker } from "@/components/staff/register-sw";
import { staffDisplayName } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/staff/actions";
import { StaffNav } from "@/app/staff/nav";
import { Logo } from "@/components/logo";

export const metadata: Metadata = {
  manifest: "/manifest.webmanifest",
  title: { default: "Team", template: "%s · La Cordobesa Team" },
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Cordobesa" },
};

export const viewport: Viewport = { themeColor: "#152f3b" };

export default function StaffLayout({ children }: LayoutProps<"/staff">) {
  return (
    <div className="staff">
      <header className="sticky top-0 z-10 border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/staff" className="flex items-center gap-2 font-serif text-lg">
            <Logo className="h-8 w-8" />
            La Cordobesa <span className="text-xs font-sans font-bold uppercase tracking-wider text-muted">Team</span>
          </Link>
          {/* Reads the session, so it streams in; the rest of the chrome stays static. */}
          <Suspense fallback={null}>
            <UserMenu />
          </Suspense>
        </div>
        <Suspense fallback={null}>
          <NavIfSignedIn />
        </Suspense>
      </header>
      <main id="main" className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      <RegisterServiceWorker />
    </div>
  );
}

async function currentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

async function UserMenu() {
  const user = await currentUser();
  if (!user) return null;
  return (
    <form action={signOut} className="flex items-center gap-3 text-xs text-muted">
      <span className="hidden sm:inline">{staffDisplayName(user.email)}</span>
      <button className="btn-ghost">Abmelden</button>
    </form>
  );
}

async function NavIfSignedIn() {
  const user = await currentUser();
  if (!user) return null;
  return <StaffNav />;
}
