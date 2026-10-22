/** The parts every staff record card is built from.
 *
 *  Reservations, pre-orders, waitlist entries and event inquiries are four different rows with the
 *  same shape of work: move it through a status, leave an internal note, reach the guest on
 *  WhatsApp. Each page had grown its own copy of all three, so a change to one card's affordances
 *  quietly stopped matching the other three.
 *
 *  Deliberately not `"use client"`: none of this needs state, and form-bits.tsx is a client module,
 *  so putting these there would have pulled four server-rendered cards into the browser bundle for
 *  markup that never changes after render. */
import { waNumber, whatsappTo } from "@/lib/contact";
import { ArrowIcon } from "@/components/icons";

/** Posts one status change. The action and the status are the only things that ever differed. */
export function StatusButton({
  action,
  id,
  status,
  label,
  primary,
  danger,
}: {
  action: (formData: FormData) => void | Promise<void>;
  id: string;
  status: string;
  label: string;
  primary?: boolean;
  danger?: boolean;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button className={`${primary ? "btn-primary" : danger ? "btn-danger" : "btn-ghost"} min-h-10`}>{label}</button>
    </form>
  );
}

/** A quiet, closed-by-default fold: a small label with a turning arrow, tall enough to tap. The
 *  summary is a flex box, which drops the browser's own marker, so the arrow is drawn here. */
export function Disclosure({
  summary,
  open,
  className,
  children,
}: {
  summary: string;
  open?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <details open={open} className={`group ${className ?? ""}`}>
      <summary className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 text-xs font-bold text-muted hover:text-blue-dark">
        <span aria-hidden className="text-[0.7em] transition-transform group-open:rotate-90">
          ▶
        </span>
        {summary}
      </summary>
      {children}
    </details>
  );
}

/** Actions that undo something or are rarely wanted, out of the way until asked for. */
export function MoreActions({ children }: { children: React.ReactNode }) {
  return (
    <Disclosure summary="Más">
      <div className="mt-1 flex flex-wrap gap-1.5">{children}</div>
    </Disclosure>
  );
}

/** The internal note under a card, folded away while there is none so an empty field does not sit
 *  on every card; a card that has a note opens with it showing. The placeholder is the only
 *  per-card part, because what counts as a useful note differs: a table number, a baking slot, a
 *  callback time. */
export function StaffNotesForm({
  action,
  id,
  value,
  placeholder,
}: {
  action: (formData: FormData) => void | Promise<void>;
  id: string;
  value: string | null;
  placeholder: string;
}) {
  return (
    <Disclosure summary="Nota" open={Boolean(value)}>
      <form action={action} className="mt-1 flex gap-2">
        <input type="hidden" name="id" value={id} />
        <input name="staff_notes" defaultValue={value ?? ""} placeholder={placeholder} aria-label="Nota interna" />
        <button className="btn-ghost min-h-10 shrink-0">OK</button>
      </form>
    </Disclosure>
  );
}

/** WhatsApp to the guest, with the message prefilled.
 *
 *  Absent when the stored number is too short to be a real one, which is what staff-entered rows
 *  look like when nobody left a number. */
export function WhatsAppButton({ phone, text, label = "WhatsApp" }: { phone: string | null; text: string; label?: string }) {
  // wa.me needs a plausible subscriber number; anything shorter is a typo, not a phone. Checked on
  // the number alone, never on the built URL, whose query string is full of unrelated digits.
  if (!phone || waNumber(phone).length < 8) return null;
  return (
    <a className="btn-ghost min-h-10" href={whatsappTo(phone, text)} target="_blank" rel="noreferrer">
      {label} <ArrowIcon direction="up-right" size={14} />
    </a>
  );
}

/** What a list page shows when its query failed. One neutral sentence: the reason is for the server
 *  log, and nothing a staff member could do about a missing migration or a dropped connection. */
export function StaffLoadError() {
  return (
    <p role="alert" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
      No pudimos cargar los datos. Volvé a intentarlo en unos minutos.
    </p>
  );
}

/** The fallback every staff page used while its Suspense boundary resolves. */
export function StaffLoading() {
  return <p className="text-sm text-muted">Cargando …</p>;
}
