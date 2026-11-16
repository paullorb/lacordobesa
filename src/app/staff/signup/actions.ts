"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createPrivilegedClient } from "@/lib/supabase/privileged";
import { STAFF_EMAIL_DOMAIN } from "@/lib/staff";
import { claimInvite, releaseInvite } from "@/lib/staff-signup";

type Result = { error: string } | null;
const USERNAME = /^[a-z0-9][a-z0-9._-]{1,31}$/;

export async function signUpStaff(token: string, _previous: Result, formData: FormData): Promise<Result> {
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  // Checked before the invite is used, so a typo costs nothing.
  if (!USERNAME.test(username)) {
    return { error: "Nombre: entre 2 y 32 caracteres; solo letras, números, puntos, guiones y guiones bajos." };
  }
  if (password.length < 10) return { error: "La contraseña debe tener al menos 10 caracteres." };

  // Server Actions are callable directly, so the invite is claimed here on every submission and not
  // trusted from the page that rendered the form. The claim is one atomic UPDATE: a second request
  // with the same link finds nothing to claim.
  const admin = createPrivilegedClient();
  const invite = await claimInvite(admin, token);
  if (!invite) return { error: "Este enlace de registro no es válido, venció o ya se usó. Pedile uno nuevo a un administrador." };

  const { data, error } = await admin.auth.admin.createUser({
    email: `${username}@${STAFF_EMAIL_DOMAIN}`,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    await releaseInvite(admin, invite.id);
    return { error: error?.message.toLowerCase().includes("already") ? "Ese nombre de usuario ya existe." : "No pudimos crear el acceso." };
  }

  const { error: staffError } = await admin.from("staff").insert({ user_id: data.user.id, role: invite.role });
  if (staffError) {
    await admin.auth.admin.deleteUser(data.user.id);
    await releaseInvite(admin, invite.id);
    return { error: "No pudimos crear el acceso." };
  }
  // Who used it, for the admin's list. Not worth failing the sign-up over.
  const { error: usedByError } = await admin.from("staff_invites").update({ used_by: data.user.id }).eq("id", invite.id);
  if (usedByError) console.error("signUpStaff used_by", usedByError);

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: `${username}@${STAFF_EMAIL_DOMAIN}`,
    password,
  });
  if (signInError) return { error: "El acceso se creó. Iniciá sesión con tu nombre de usuario y contraseña." };
  redirect("/staff");
}
