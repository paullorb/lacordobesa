"use client";

import { useActionState } from "react";
import { cancelPreorder, type GuestPreorder } from "@/app/vorbestellen/actions";
import { fmtDateDE } from "@/lib/dates";

const NOTE: Record<GuestPreorder["status"], string> = {
  pending: "Wir prüfen deine Bestellung und melden uns, um sie zu bestätigen.",
  confirmed: "Deine Bestellung ist bestätigt. Wir haben alles für dich notiert.",
  ready: "Deine Bestellung liegt zum Abholen bereit. ¡Hasta pronto!",
  collected: "Abgeholt. Danke für deine Bestellung, ¡gracias!",
  cancelled: "Diese Vorbestellung ist storniert. Du kannst jederzeit neu bestellen.",
};

const LABEL: Record<GuestPreorder["status"], string> = {
  pending: "Offen",
  confirmed: "Bestätigt",
  ready: "Zum Abholen bereit",
  collected: "Abgeholt",
  cancelled: "Storniert",
};

export function ManagePreorder({ token, order }: { token: string; order: GuestPreorder }) {
  const [state, cancelAction, cancelling] = useActionState(cancelPreorder, null);

  if (state?.ok) {
    return (
      <div className="form-success" role="status">
        <strong>Vorbestellung storniert.</strong>
        <p>Danke, dass du uns Bescheid gegeben hast. Du kannst jederzeit neu bestellen.</p>
      </div>
    );
  }

  // 'ready' is already baked, so cancelling it is a phone call rather than a click (the RPC rejects it too).
  const cancellable = order.status === "pending" || order.status === "confirmed";

  return (
    <div className="manage">
      <dl className="manage-facts">
        <div>
          <dt>Name</dt>
          <dd>{order.name}</dd>
        </div>
        <div>
          <dt>Abholung</dt>
          <dd>{fmtDateDE(order.pickupDate)}</dd>
        </div>
        <div>
          <dt>Uhrzeit</dt>
          <dd>{order.pickupTime} Uhr</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{LABEL[order.status]}</dd>
        </div>
      </dl>

      <ul className="preorder-summary">
        {order.lines.map((l) => (
          <li key={l.label}>
            <span>
              <strong>
                {l.quantity} × {l.label}
              </strong>
              <small>
                pro {l.unit}
                {l.price ? ` · ${l.price}` : ""}
              </small>
            </span>
          </li>
        ))}
      </ul>

      <p className="manage-note">{NOTE[order.status]}</p>
      {order.notes && <p className="manage-guest-note">„{order.notes}“</p>}

      {state && !state.ok && (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      )}

      {cancellable && (
        <form
          action={cancelAction}
          onSubmit={(e) => {
            if (!window.confirm("Vorbestellung wirklich stornieren?")) e.preventDefault();
          }}
        >
          <input type="hidden" name="token" value={token} />
          <button type="submit" className="button button-quiet" disabled={cancelling}>
            {cancelling ? "Wird storniert …" : "Vorbestellung stornieren"}
          </button>
        </form>
      )}
      <p className="manage-hint">Bezahlt wird bei der Abholung.</p>
    </div>
  );
}
