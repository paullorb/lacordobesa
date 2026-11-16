"use server";

import { issueTicket } from "@/lib/form-ticket";
import { isPublicForm } from "@/lib/public-forms";
import { secretKey } from "@/lib/supabase/privileged";

/** Hands a public form its signed opening time (see src/lib/form-ticket.ts). Called by the form
 *  when it mounts, so the page itself stays a static shell. Returns "" for an unknown form or when
 *  the server cannot sign; the submission then simply has no ticket. */
export async function issueFormTicket(form: string): Promise<string> {
  if (!isPublicForm(form)) return "";
  try {
    return issueTicket(secretKey(), form);
  } catch {
    return "";
  }
}
