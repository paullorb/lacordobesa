import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { RegisterServiceWorker } from "@/components/admin/register-sw";
import { staffDisplayName } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";
import { AdminNav } from "./nav";

export const metadata: Metadata = {
  title: { default: "Team", template: "%s · La Cordobesa Team" },
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Cordobesa" },
};

export const viewport: Viewport = { themeColor: "#152f3b" };

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="admin">
      <header className="sticky top-0 z-10 border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <a href="/admin" className="flex items-center gap-2 font-serif text-lg">
            <img src="/assets/logo.svg" alt="" className="h-8 w-8" />
            La Cordobesa <span className="text-xs font-sans font-bold uppercase tracking-wider text-muted">Team</span>
          </a>
          {/* Reads the session, so it streams in; the rest of the chrome stays static. */}
          <Suspense fallback={null}>
            <UserMenu />
          </Suspense>
        </div>
        <Suspense fallback={null}>
          <NavIfSignedIn />
        </Suspense>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
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
  return <AdminNav />;
}
