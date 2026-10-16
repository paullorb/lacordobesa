"use client";

import { useActionState } from "react";
import { cancelPreorder, type GuestPreorder } from "@/app/vorbestellen/actions";
import { fmtDate } from "@/lib/dates";
import { getDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/i18n";

export function ManagePreorder({ locale, token, order }: { locale: Locale; token: string; order: GuestPreorder }) {
  const [state, cancelAction, cancelling] = useActionState(cancelPreorder, null);
  const t = getDictionary(locale).managePreorder;

  if (state?.ok) {
    return (
      <div className="form-success" role="status">
        <strong>{t.cancelledTitle}</strong>
        <p>{t.cancelledText}</p>
      </div>
    );
  }

  // 'ready' is already baked, so cancelling it is a phone call rather than a click (the RPC rejects it too).
  const cancellable = order.status === "pending" || order.status === "confirmed";

  return (
    <div className="manage">
      <dl className="manage-facts">
        <div>
          <dt>{t.name}</dt>
          <dd>{order.name}</dd>
        </div>
        <div>
          <dt>{t.pickup}</dt>
          <dd>{fmtDate(order.pickupDate, locale)}</dd>
        </div>
        <div>
          <dt>{t.time}</dt>
          <dd>
            {`${order.pickupTime} ${t.at}`.trim()}
          </dd>
        </div>
        {order.preparation && (
          <div>
            <dt>{t.preparation}</dt>
            <dd>{t.preparations[order.preparation]}</dd>
          </div>
        )}
        <div>
          <dt>{t.status}</dt>
          <dd>{t.statuses[order.status].label}</dd>
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
                {t.per(l.unit)}
                {l.price ? ` · ${l.price}` : ""}
              </small>
            </span>
          </li>
        ))}
      </ul>

      <p className="manage-note">{t.statuses[order.status].note}</p>
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
            if (!window.confirm(t.confirmCancel)) e.preventDefault();
          }}
        >
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="locale" value={locale} />
          <button type="submit" className="button button-quiet" disabled={cancelling}>
            {cancelling ? t.cancelling : t.cancel}
          </button>
        </form>
      )}
      <p className="manage-hint">{t.payAtPickup}</p>
    </div>
  );
}
