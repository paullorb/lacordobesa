"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createPrivilegedClient } from "@/lib/supabase/privileged";
import { STAFF_EMAIL_DOMAIN } from "@/lib/staff";
import { validStaffSignupToken } from "@/lib/staff-signup";

type Result = { error: string } | null;
const USERNAME = /^[a-z0-9][a-z0-9._-]{1,31}$/;

export async function signUpStaff(token: string, _previous: Result, formData: FormData): Promise<Result> {
  // Server Actions are callable directly: check the bearer token on every submission.
  if (!validStaffSignupToken(token)) return { error: "Este enlace de registro no es válido." };
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!USERNAME.test(username)) {
    return { error: "Nombre: entre 2 y 32 caracteres; solo letras, números, puntos, guiones y guiones bajos." };
  }
  if (password.length < 10) return { error: "La contraseña debe tener al menos 10 caracteres." };

  const admin = createPrivilegedClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: `${username}@${STAFF_EMAIL_DOMAIN}`,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    return { error: error?.message.toLowerCase().includes("already") ? "Ese nombre de usuario ya existe." : "No pudimos crear el acceso." };
  }

  const { error: staffError } = await admin.from("staff").insert({ user_id: data.user.id, role: "staff" });
  if (staffError) {
    await admin.auth.admin.deleteUser(data.user.id);
    return { error: "No pudimos crear el acceso." };
  }

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: `${username}@${STAFF_EMAIL_DOMAIN}`,
    password,
  });
  if (signInError) return { error: "El acceso se creó. Iniciá sesión con tu nombre de usuario y contraseña." };
  redirect("/staff");
}
