"use client";

import { useActionState, useState, useTransition } from "react";
import { getAvailability, type Slot } from "@/app/reservierung/actions";
import { cancelReservation, moveReservation, type GuestReservation, type ManageState } from "@/app/reservierung/actions";
import { fmtDate } from "@/lib/dates";
import { getDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/i18n";

export function ManageReservation({
  locale,
  token,
  reservation,
  maxPartySize,
  minDate,
  maxDate,
}: {
  locale: Locale;
  token: string;
  reservation: GuestReservation;
  maxPartySize: number;
  minDate: string;
  maxDate: string;
}) {
  const t = getDictionary(locale).manage;
  const [cancelState, cancelAction, cancelling] = useActionState(cancelReservation, null);
  const [moveState, moveAction, moving] = useActionState(moveReservation, null);

  const [date, setDate] = useState("");
  const [daySlots, setDaySlots] = useState<Slot[]>([]);
  const [time, setTime] = useState("");
  // The party the guest is moving to, which may differ from the one booked. Kept as typed, so the
  // field can be cleared mid-edit; the slot filter reads it as a number.
  const [party, setParty] = useState(String(reservation.partySize));
  const partySize = Math.max(1, Number(party) || reservation.partySize);
  const slots = daySlots.filter((s) => s.seatsLeft >= partySize);
  const [loading, startLoading] = useTransition();

  // The booking the server last told us about. After a successful move the old summary is stale, so the
  // result banner carries the new values instead of re-rendering the row from props.
  const done: ManageState = cancelState?.ok ? cancelState : moveState?.ok ? moveState : null;
  const error = (!cancelState?.ok && cancelState?.error) || (!moveState?.ok && moveState?.error) || null;

  const open = reservation.status === "pending" || reservation.status === "confirmed";
  const changeable = open && reservation.changesLeft > 0 && reservation.date >= minDate;

  function chooseDate(value: string) {
    setDate(value);
    setTime("");
    setDaySlots([]);
    startLoading(async () => {
      const result = await getAvailability(value);
      setDaySlots(result.slots);
    });
  }

  if (done) {
    return (
      <div className="form-success" role="status">
        <strong>{done.action === "cancelled" ? t.cancelledTitle : t.movedTitle}</strong>
        <p>
          {done.action === "cancelled" ? t.cancelledText : t.movedText(fmtDate(date, locale), time)}
        </p>
      </div>
    );
  }

  return (
    <div className="manage">
      <dl className="manage-facts">
        <div>
          <dt>{t.name}</dt>
          <dd>{reservation.name}</dd>
        </div>
        <div>
          <dt>{t.date}</dt>
          <dd>{fmtDate(reservation.date, locale)}</dd>
        </div>
        <div>
          <dt>{t.time}</dt>
          <dd>
            {`${reservation.time} ${t.at}`.trim()}
          </dd>
        </div>
        <div>
          <dt>{t.people}</dt>
          <dd>{reservation.partySize}</dd>
        </div>
        <div>
          <dt>{t.status}</dt>
          <dd>{t.statuses[reservation.status].label}</dd>
        </div>
      </dl>
      <p className="manage-note">{t.statuses[reservation.status].note}</p>
      {reservation.notes && <p className="manage-guest-note">„{reservation.notes}“</p>}

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {open && (
        <div className="manage-actions">
          {changeable && (
            <details className="manage-move">
              <summary>{t.move}</summary>
              <form action={moveAction} className="manage-move-form">
                <input type="hidden" name="token" value={token} />
                <input type="hidden" name="locale" value={locale} />
                <label htmlFor="manage-date">{t.newDate}</label>
                <input
                  id="manage-date"
                  type="date"
                  value={date}
                  min={minDate}
                  max={maxDate}
                  onChange={(e) => chooseDate(e.target.value)}
                  required
                />

                {date && (
                  <>
                    <span className="manage-label">{t.newTime}</span>
                    {loading ? (
                      <p className="manage-hint">{t.loadingSlots}</p>
                    ) : slots.length > 0 ? (
                      <div className="slots times" role="group" aria-label={t.pickNewTime}>
                        {slots.map((s) => (
                          <button
                            key={s.time}
                            type="button"
                            className="slot"
                            aria-pressed={time === s.time}
                            onClick={() => setTime(s.time)}
                          >
                            {s.time}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="manage-hint">
                        {t.nothingFree(
                          `${partySize} ${partySize === 1 ? getDictionary(locale).reservation.person : getDictionary(locale).reservation.people}`,
                        )}
                      </p>
                    )}
                  </>
                )}

                <input type="hidden" name="date" value={date} />
                <input type="hidden" name="time" value={time} />
                <label htmlFor="manage-party">{t.partyLabel}</label>
                <input
                  id="manage-party"
                  name="party_size"
                  type="number"
                  min={1}
                  max={maxPartySize}
                  value={party}
                  onChange={(e) => {
                    setParty(e.target.value);
                    // A time picked for the old party may not fit the new one.
                    const next = Math.max(1, Number(e.target.value) || reservation.partySize);
                    if (time && !daySlots.some((s) => s.time === time && s.seatsLeft >= next)) setTime("");
                  }}
                  required
                />

                <button type="submit" className="button" disabled={!time || moving}>
                  {moving ? t.moving : t.doMove}
                </button>
                <p className="manage-hint">
                  {t.moveNote}
                  {reservation.changesLeft === 1 ? t.lastChange : t.changesLeft(reservation.changesLeft)}
                </p>
              </form>
            </details>
          )}

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
        </div>
      )}
    </div>
  );
}
