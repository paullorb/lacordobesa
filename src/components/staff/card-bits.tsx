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
      <button className={primary ? "btn-primary" : danger ? "btn-danger" : "btn-ghost"}>{label}</button>
    </form>
  );
}

/** The internal note under a card. The placeholder is the only per-card part, because what counts
 *  as a useful note differs: a table number, a baking slot, a callback time. */
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
    <form action={action} className="flex gap-2">
      <input type="hidden" name="id" value={id} />
      <input name="staff_notes" defaultValue={value ?? ""} placeholder={placeholder} />
      <button className="btn-ghost shrink-0">OK</button>
    </form>
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
    <a className="btn-ghost" href={whatsappTo(phone, text)} target="_blank" rel="noreferrer">
      {label} ↗
    </a>
  );
}

/** The fallback every staff page used while its Suspense boundary resolves. */
export function StaffLoading() {
  return <p className="text-sm text-muted">Lade …</p>;
}
