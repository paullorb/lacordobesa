"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { createReservationManually } from "@/app/staff/actions";
import { getAvailability, type Slot } from "@/app/reservierung/actions";
import { SubmitButton } from "@/components/staff/form-bits";
import { DateField, TimeField } from "@/components/staff/pickers";
import { FIELD_LIMITS } from "@/lib/reservation-limits";

/** Taking a booking over the phone or at the counter.
 *
 *  Shares the *availability* with the public wizard, not the wizard itself. getAvailability() is the
 *  same Server Action /#reservieren calls, so what staff see is what a guest would see, and the
 *  seats-left numbers cannot drift apart. It reaches the database through the anon client, which is
 *  also why it works from here at all: migration 20261012091555 revoked the `authenticated` grant on
 *  the booking RPCs, so a cookie-backed call would be denied.
 *
 *  What it deliberately does *not* borrow is the wizard's gating. The public form only offers slots
 *  with a free seat; this one offers every slot, marks the full ones, and still lets a staff member
 *  type a time by hand. A walk-in on a full evening is exactly the booking the restaurant wants to
 *  take, and createReservationManually() inserts straight into the table rather than going through
 *  request_reservation(), so none of the anon-shaped abuse limits apply to somebody on the phone. */
export function StaffReservationForm({ date: initialDate, maxPartySize }: { date: string; maxPartySize: number }) {
  const [state, formAction] = useActionState(createReservationManually, null);
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState("");
  // A string, so the field can be cleared while typing; the warning reads it as a number.
  const [party, setParty] = useState("2");
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [loading, startLoading] = useTransition();
  const request = useRef(0);

  useEffect(() => {
    if (!date) return;
    const id = ++request.current;
    startLoading(async () => {
      const result = await getAvailability(date);
      // A slower earlier request must not overwrite a newer day's slots.
      if (id === request.current) setSlots(result.slots);
    });
  }, [date]);

  const chosen = slots?.find((s) => s.time === time);
  // Worth saying out loud, because the booking will go through regardless. Measured against the
  // party, not against zero: three seats left is still an overbooking for a table of eight.
  const overbooking =
    time !== "" && slots !== null && slots.length > 0 && (!chosen || chosen.seatsLeft < Math.max(1, Number(party) || 0));

  return (
    <form action={formAction} className="mt-4 grid gap-3 sm:grid-cols-2">
      <div>
        <label htmlFor="m-name">Nombre</label>
        <input id="m-name" name="name" maxLength={FIELD_LIMITS.name} required />
      </div>
      <div>
        <label htmlFor="m-phone">Teléfono</label>
        <input id="m-phone" name="phone" type="tel" maxLength={FIELD_LIMITS.phone} />
      </div>
      <div>
        <label htmlFor="m-date">Fecha</label>
        <DateField
          id="m-date"
          name="date"
          value={date}
          onChange={(v) => {
            setDate(v);
            setTime("");
            // The previous day's times must not stay clickable while the new day loads.
            setSlots(null);
          }}
          required
        />
      </div>
      <div>
        <label htmlFor="m-time">Hora</label>
        <TimeField id="m-time" name="time" value={time} onChange={setTime} required />
      </div>

      <div className="sm:col-span-2">
        <label id="m-slots-label">Horarios disponibles {loading && <span className="font-normal normal-case">cargando …</span>}</label>
        {slots && slots.length > 0 ? (
          <div className="slots times" role="group" aria-labelledby="m-slots-label">
            {slots.map((s) => (
              <button
                key={s.time}
                type="button"
                className="slot"
                aria-pressed={time === s.time}
                // Not disabled, unlike the public wizard: a full slot is still bookable here.
                title={s.seatsLeft > 0 ? `${s.seatsLeft} lugares libres` : "Completo"}
                onClick={() => setTime(s.time)}
              >
                {s.time}
                <small className="block text-xs font-normal opacity-70">
                  {s.seatsLeft > 0 ? `${s.seatsLeft} libres` : "completo"}
                </small>
              </button>
            ))}
          </div>
        ) : (
          !loading && (
            <p className="text-sm text-muted">
              {slots === null
                ? "Elegí una fecha para ver los horarios disponibles."
                : "No hay horarios disponibles ese día, por ejemplo porque está cerrado. Podés añadir la reserva de todos modos."}
            </p>
          )
        )}
        {overbooking && (
          <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            A esa hora no quedan suficientes lugares para {party || "esas"} personas. La reserva se añadirá de todos modos.
          </p>
        )}
      </div>

      <div>
        <label htmlFor="m-party">Personas</label>
        <input
          id="m-party"
          name="party_size"
          type="number"
          min={1}
          max={50}
          value={party}
          onChange={(e) => setParty(e.target.value)}
          required
        />
        <p className="mt-1 text-xs text-muted">En línea se permiten hasta {maxPartySize}; aquí no hay límite.</p>
      </div>
      <div>
        <label htmlFor="m-email">E-Mail</label>
        <input id="m-email" name="email" type="email" maxLength={FIELD_LIMITS.email} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="m-notes">Nota</label>
        <input id="m-notes" name="notes" maxLength={FIELD_LIMITS.notes} />
      </div>

      {state && !state.ok && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2" role="alert">
          {state.error}
        </p>
      )}
      {state?.ok && <p className="text-sm text-emerald-700 sm:col-span-2">Reserva añadida.</p>}

      <div className="sm:col-span-2">
        <SubmitButton>Guardar como confirmada</SubmitButton>
      </div>
    </form>
  );
}
