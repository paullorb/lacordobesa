"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import type { ActionResult } from "@/app/staff/actions";

export function SubmitButton({
  children,
  className = "btn-primary",
  pendingText = "Guardando …",
}: {
  children: React.ReactNode;
  className?: string;
  pendingText?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? pendingText : children}
    </button>
  );
}

/** Form wrapper for actions that return an ActionResult, showing errors/success inline. */
export function ActionForm({
  action,
  children,
  className = "grid gap-3",
  successText = "Guardado.",
}: {
  action: (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  className?: string;
  successText?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className={className}>
      {children}
      {state && !state.ok && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {state.error}
        </p>
      )}
      {state?.ok && <p className="text-sm text-emerald-700">{successText}</p>}
    </form>
  );
}

/** A form around one button (a status change, a delete, a toggle) that shows why the click did not
 *  work. Those actions used to return nothing, so a failed write looked exactly like a slow one. The
 *  message appears under the button and goes away on the next submit. */
export function QuickForm({
  action,
  children,
  className,
}: {
  action: (formData: FormData) => Promise<ActionResult | void>;
  children: React.ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(async (_prev: ActionResult, fd: FormData) => (await action(fd)) ?? null, null);
  return (
    <form action={formAction} className={className}>
      {children}
      {state && !state.ok && (
        <p className="mt-1 max-w-xs rounded-md bg-red-50 px-2 py-1 text-xs text-red-700" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}

/** The internal note field of a staff card. Controlled and submitted by hand rather than as a form
 *  action: React resets an uncontrolled field when an action finishes, so a note that failed to save
 *  (too long, connection dropped) would have vanished from the box along with the error. Here the
 *  text stays until it has been saved. The limit is the `staff_notes_len` check in the database. */
export function NotesField({
  action,
  id,
  value,
  placeholder,
  maxLength = 2000,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  id: string;
  value: string | null;
  placeholder: string;
  maxLength?: number;
}) {
  const [text, setText] = useState(value ?? "");
  const [state, setState] = useState<ActionResult>(null);
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="mt-1 grid gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData();
        fd.set("id", id);
        fd.set("staff_notes", text);
        startTransition(async () => setState(await action(fd)));
      }}
    >
      <div className="flex gap-2">
        <input
          name="staff_notes"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setState(null);
          }}
          maxLength={maxLength}
          placeholder={placeholder}
          aria-label="Nota interna"
        />
        <button className="btn-ghost min-h-10 shrink-0" disabled={pending}>
          {pending ? "…" : "OK"}
        </button>
      </div>
      {state && !state.ok && (
        <p className="rounded-md bg-red-50 px-2 py-1 text-xs text-red-700" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}

/** Asks before submitting; for delete buttons. */
export function ConfirmSubmit({
  message,
  children,
  className = "btn-danger",
}: {
  message: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
