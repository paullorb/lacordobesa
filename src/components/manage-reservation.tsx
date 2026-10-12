"use client";

import { useActionState, useState, useTransition } from "react";
import { getAvailability, type Slot } from "@/app/reservations/actions";
import { cancelReservation, moveReservation, type GuestReservation, type ManageState } from "@/app/reservierung/actions";
import { fmtDateDE } from "@/lib/dates";

const STATUS: Record<GuestReservation["status"], { label: string; note: string }> = {
  pending: { label: "Noch offen", note: "Wir melden uns, sobald wir deinen Tisch bestätigen können." },
  confirmed: { label: "Bestätigt", note: "Dein Tisch ist für dich reserviert. ¡Hasta pronto!" },
  cancelled: { label: "Storniert", note: "Diese Reservierung ist storniert. Du kannst jederzeit neu anfragen." },
  no_show: { label: "Nicht erschienen", note: "Zu diesem Termin haben wir dich leider nicht gesehen." },
  completed: { label: "Erledigt", note: "Danke für deinen Besuch. ¡Gracias!" },
};

export function ManageReservation({
  token,
  reservation,
  maxPartySize,
  minDate,
  maxDate,
}: {
  token: string;
  reservation: GuestReservation;
  maxPartySize: number;
  minDate: string;
  maxDate: string;
}) {
  const [cancelState, cancelAction, cancelling] = useActionState(cancelReservation, null);
  const [moveState, moveAction, moving] = useActionState(moveReservation, null);

  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [time, setTime] = useState("");
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
    setSlots([]);
    startLoading(async () => {
      const result = await getAvailability(value);
      setSlots(result.slots.filter((s) => s.seatsLeft >= reservation.partySize));
    });
  }

  if (done) {
    return (
      <div className="form-success" role="status">
        <strong>{done.action === "cancelled" ? "Reservierung storniert." : "Neuer Termin angefragt."}</strong>
        <p>
          {done.action === "cancelled"
            ? "Danke, dass du uns Bescheid gegeben hast. So kann jemand anderes den Tisch bekommen."
            : `Wir haben deine Anfrage auf ${fmtDateDE(date)} um ${time} Uhr geändert und melden uns, sobald sie bestätigt ist.`}
        </p>
      </div>
    );
  }

  return (
    <div className="manage">
      <dl className="manage-facts">
        <div>
          <dt>Name</dt>
          <dd>{reservation.name}</dd>
        </div>
        <div>
          <dt>Datum</dt>
          <dd>{fmtDateDE(reservation.date)}</dd>
        </div>
        <div>
          <dt>Uhrzeit</dt>
          <dd>{reservation.time} Uhr</dd>
        </div>
        <div>
          <dt>Personen</dt>
          <dd>{reservation.partySize}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{STATUS[reservation.status].label}</dd>
        </div>
      </dl>
      <p className="manage-note">{STATUS[reservation.status].note}</p>
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
              <summary>Termin verschieben</summary>
              <form action={moveAction} className="manage-move-form">
                <input type="hidden" name="token" value={token} />
                <label htmlFor="manage-date">Neues Datum</label>
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
                    <span className="manage-label">Neue Uhrzeit</span>
                    {loading ? (
                      <p className="manage-hint">Freie Zeiten werden geladen …</p>
                    ) : slots.length > 0 ? (
                      <div className="slots times" role="group" aria-label="Neue Uhrzeit wählen">
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
                        An diesem Tag ist für {reservation.partySize} {reservation.partySize === 1 ? "Person" : "Personen"} leider
                        nichts frei. Bitte wähle einen anderen Tag.
                      </p>
                    )}
                  </>
                )}

                <input type="hidden" name="date" value={date} />
                <input type="hidden" name="time" value={time} />
                <label htmlFor="manage-party">Personen</label>
                <input
                  id="manage-party"
                  name="party_size"
                  type="number"
                  min={1}
                  max={maxPartySize}
                  defaultValue={reservation.partySize}
                  required
                />

                <button type="submit" className="button" disabled={!time || moving}>
                  {moving ? "Wird geändert …" : "Termin ändern"}
                </button>
                <p className="manage-hint">
                  Nach einer Änderung prüfen wir den neuen Termin noch einmal und bestätigen ihn dir.
                  {reservation.changesLeft === 1
                    ? " Das ist die letzte Änderung, die online möglich ist."
                    : ` Noch ${reservation.changesLeft} Änderungen online möglich.`}
                </p>
              </form>
            </details>
          )}

          <form
            action={cancelAction}
            onSubmit={(e) => {
              if (!window.confirm("Reservierung wirklich stornieren?")) e.preventDefault();
            }}
          >
            <input type="hidden" name="token" value={token} />
            <button type="submit" className="button button-quiet" disabled={cancelling}>
              {cancelling ? "Wird storniert …" : "Reservierung stornieren"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
