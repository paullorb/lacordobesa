"use client";

import type { ReactNode } from "react";
import { FIELD_LIMITS } from "@/lib/reservation-limits";

export type Contact = { name: string; phone: string; email: string; notes: string };

type Props = {
  /** Prefix for the field ids, so two forms on one page never share one. */
  id: string;
  value: Contact;
  onChange: (value: Contact) => void;
  labels: { name: string; phone: string; email: string; notes: string; notesPlaceholder: string };
  /** The free-text field's form name: "notes" for a table or an order, "message" for an inquiry. */
  notesName?: string;
  notesMax?: number;
  /** The error, the submit button and any note under it. Shown once name and phone are in. */
  children: ReactNode;
};

/**
 * The last step of every wizard on the site: who we call back.
 *
 * Name and phone are all the shop needs, so they come first and alone. The optional fields and the
 * send button unfold once both hold something, which keeps the step short for the guest who only
 * wants to be called. `inert` keeps the folded fields out of the tab order until then. The values
 * live in the parent's state, because going back through a chip unmounts this step.
 */
export function ContactFields({ id, value, onChange, labels, notesName = "notes", notesMax = FIELD_LIMITS.notes, children }: Props) {
  const ready = value.name.trim().length >= 2 && value.phone.trim().length >= 5;
  const field = (key: keyof Contact) => ({
    value: value[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange({ ...value, [key]: e.target.value }),
  });

  return (
    <>
      <div className="form-row">
        <div className="field-float">
          <input id={`${id}-name`} name="name" required minLength={2} maxLength={FIELD_LIMITS.name} autoComplete="name" placeholder="María González" {...field("name")} />
          <label htmlFor={`${id}-name`}>{labels.name}</label>
        </div>
        <div className="field-float">
          <input id={`${id}-phone`} name="phone" type="tel" required minLength={5} maxLength={FIELD_LIMITS.phone} autoComplete="tel" placeholder="+49 170 1234567" {...field("phone")} />
          <label htmlFor={`${id}-phone`}>{labels.phone}</label>
        </div>
      </div>
      <div className="reveal" data-open={ready} inert={!ready}>
        <div className="reveal-inner">
          <div className="field-float">
            <input id={`${id}-email`} name="email" type="email" maxLength={FIELD_LIMITS.email} autoComplete="email" placeholder="maria@example.com" {...field("email")} />
            <label htmlFor={`${id}-email`}>{labels.email}</label>
          </div>
          <div className="field-float">
            <textarea id={`${id}-notes`} name={notesName} rows={3} maxLength={notesMax} placeholder={labels.notesPlaceholder} {...field("notes")} />
            <label htmlFor={`${id}-notes`}>{labels.notes}</label>
          </div>
          {children}
        </div>
      </div>
    </>
  );
}
