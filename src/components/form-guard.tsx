"use client";

import { useEffect, useState, type ReactNode } from "react";
import { issueFormTicket } from "@/app/form-ticket";

/** The two hidden fields every public form carries, and the ticket behind one of them.
 *
 *  Call it in the component that owns the form, not in the `<form>` itself: a wizard only mounts its
 *  `<form>` on the last step, and the ticket has to be fetched when the guest *starts*, or the
 *  minimum-age check would measure the last step alone. Render the returned node inside the `<form>`.
 *
 *  - `ticket`: signed opening time, fetched on mount (src/lib/form-ticket.ts).
 *  - `website`: a honeypot. People never see or reach it; a script that fills every input does. */
export function useFormGuard(form: string): ReactNode {
  const [ticket, setTicket] = useState("");
  useEffect(() => {
    let live = true;
    issueFormTicket(form).then(
      (value) => live && setTicket(value),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [form]);

  return (
    <>
      <input type="hidden" name="ticket" value={ticket} />
      <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
        <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>
    </>
  );
}
