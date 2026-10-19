import { DEFAULT_RESERVATION_SETTINGS, type ReservationSettings } from "@/lib/data";

/** The stored JSON with only the submitted keys replaced.
 *
 *  The staff settings form carries a few of the keys behind `reservations` and `preorders`; the rest
 *  (slot length, sitting length, lead times, ...) are not edited there. A save therefore must not
 *  rebuild the object from the form, or every key the form lacks would fall back to its default.
 *  `stored` is whatever site_settings holds, which may be missing or not an object at all. */
export function mergeStored<T extends object>(stored: unknown, submitted: Partial<T>): Partial<T> {
  const base = stored && typeof stored === "object" && !Array.isArray(stored) ? (stored as Partial<T>) : {};
  return { ...base, ...submitted };
}

/** The reservation settings to store: submitted keys over stored keys over the defaults.
 *
 *  `mergeStored` alone is not enough for the first save. When `site_settings.reservations` is
 *  absent, which is a fresh database, it writes only the three keys the form carries, and the SQL
 *  `reservation_settings()` fills in defaults only when the whole row is missing, not per key. The
 *  row would then hold NULL for `slot_minutes`, `duration_minutes` and
 *  `last_seating_minutes_before_close`, `reservation_availability()` would return no slots, and
 *  nobody could book. Writing the effective object keeps every key present. */
export function mergeReservationSettings(stored: unknown, submitted: Partial<ReservationSettings>): ReservationSettings {
  return { ...effectiveReservationSettings(stored), ...submitted };
}

/** The reservation settings as they apply today: stored keys over the built-in defaults. */
export function effectiveReservationSettings(stored: unknown): ReservationSettings {
  return { ...DEFAULT_RESERVATION_SETTINGS, ...mergeStored<ReservationSettings>(stored, {}) };
}

/** Checks the two reservation numbers the form submits. Only those, on purpose: a stored value the
 *  form cannot show must never make a save fail, because nobody could fix it from there. */
export function reservationFormError(submitted: Pick<ReservationSettings, "capacity_seats" | "max_party_size">): string | null {
  if (submitted.capacity_seats < 1 || submitted.max_party_size < 1) {
    return "Bitte sinnvolle Werte eintragen (mindestens 1 Sitzplatz und 1 Person).";
  }
  return null;
}
