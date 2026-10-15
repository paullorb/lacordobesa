import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { RegisterServiceWorker } from "@/components/staff/register-sw";
import { staffDisplayName } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";
import { APPS, ICONS } from "@/lib/brand";
import { StaffNav } from "@/app/staff/nav";
import { Logo } from "@/components/logo";
import { SignOutButton } from "@/components/staff/sign-out-button";

export const metadata: Metadata = {
  // Its own manifest, name and home-screen tile, so it installs beside the public site, not over it.
  manifest: APPS.staff.path,
  icons: { icon: [...ICONS.favicon], apple: APPS.staff.appleIcon },
  title: { default: "Team", template: "%s · La Cordobesa Team" },
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, statusBarStyle: "default", title: APPS.staff.shortName },
};

export const viewport: Viewport = { themeColor: APPS.staff.themeColor };

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
  // Same reason as requireStaff(): getUser() reads the clock, which a runtime prefetch may not.
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

async function UserMenu() {
  const user = await currentUser();
  if (!user) return null;
  return <SignOutButton name={staffDisplayName(user.email)} />;
}

async function NavIfSignedIn() {
  const user = await currentUser();
  if (!user) return null;
  return <StaffNav />;
}
