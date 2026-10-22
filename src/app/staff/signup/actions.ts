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
  if (!validStaffSignupToken(token)) return { error: "Dieser Anmeldelink ist ungültig." };
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!USERNAME.test(username)) {
    return { error: "Name: 2 bis 32 Zeichen, nur Kleinbuchstaben, Ziffern, Punkt, Strich." };
  }
  if (password.length < 10) return { error: "Passwort: mindestens 10 Zeichen." };

  const admin = createPrivilegedClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: `${username}@${STAFF_EMAIL_DOMAIN}`,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    return { error: error?.message.toLowerCase().includes("already") ? "Diesen Namen gibt es schon." : "Der Zugang konnte nicht angelegt werden." };
  }

  const { error: staffError } = await admin.from("staff").insert({ user_id: data.user.id, role: "staff" });
  if (staffError) {
    await admin.auth.admin.deleteUser(data.user.id);
    return { error: "Der Zugang konnte nicht angelegt werden." };
  }

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: `${username}@${STAFF_EMAIL_DOMAIN}`,
    password,
  });
  if (signInError) return { error: "Zugang angelegt. Bitte melde dich mit deinem Namen und Passwort an." };
  redirect("/staff");
}
