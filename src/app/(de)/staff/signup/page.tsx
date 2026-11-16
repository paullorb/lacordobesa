import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { SignupForm } from "@/app/staff/signup/signup-form";
import { inviteIsLive, isInviteToken } from "@/lib/staff-signup";
import { createPrivilegedClient } from "@/lib/supabase/privileged";
import { staffSession } from "@/lib/auth";

// no-referrer: the invite is in the URL, and a link clicked from this page must not carry it along.
export const metadata = { title: "Crear acceso al equipo", robots: { index: false, follow: false }, referrer: "no-referrer" as const };

export default function SignupPage(props: PageProps<"/staff/signup">) {
  return <Suspense fallback={null}><SignupWithToken searchParams={props.searchParams} /></Suspense>;
}

async function SignupWithToken({ searchParams }: Pick<PageProps<"/staff/signup">, "searchParams">) {
  const { key } = await searchParams;
  const token = typeof key === "string" ? key : "";
  // Looked at, not used: the invite is claimed by the form's Server Action.
  if (!isInviteToken(token) || !(await inviteIsLive(createPrivilegedClient(), token))) notFound();
  const { isStaff } = await staffSession();
  if (isStaff) redirect("/staff");

  return (
    <div className="mx-auto mt-10 max-w-sm">
      <div className="card">
        <h1 className="mb-1 font-serif text-2xl">Crear acceso al equipo</h1>
        <p className="mb-5 text-sm text-muted">Elegí un nombre de usuario y una contraseña. Después entrarás directamente al área del equipo.</p>
        <SignupForm token={token} />
      </div>
    </div>
  );
}
