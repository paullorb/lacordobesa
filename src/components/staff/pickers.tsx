"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { ArrowIcon } from "@/components/icons";
import { fmtStaffDate, monthRange, shiftMonth, todayISO } from "@/lib/dates";

/**
 * Date and time fields for the staff area.
 *
 * On a phone the native pickers are the good ones: a wheel for the time, the system calendar for the
 * date. On a desktop they are not. Chrome's time field is three tiny spin segments, Safari's has no
 * popup at all, and setting fourteen opening times one segment at a time is the slowest thing on
 * the Öffnungszeiten page. So with a mouse (`pointer: fine`) these render their own: a typeable time
 * with a list of times beside it, and a date button that opens a month grid. With a finger, the
 * native input, unchanged.
 *
 * Both submit the same strings the native inputs do (`HH:MM`, `YYYY-MM-DD`), under the same `name`,
 * so the Server Actions cannot tell which one was used.
 */

/** Monday first. Not WEEKDAYS_DE from lib/data, which would pull its cached server reads into this bundle. */
const HEADS = ["lu", "ma", "mi", "ju", "vi", "sá", "do"];

const FINE = "(pointer: fine)";
const subscribe = (onChange: () => void) => {
  const mq = window.matchMedia(FINE);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
};
/** False on the server and during hydration, so the first paint is the native input everywhere. */
function useFinePointer() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(FINE).matches,
    () => false,
  );
}

/** Controlled when `value` is given, otherwise it keeps its own, like an `<input>`. */
function useFieldValue(value: string | undefined, defaultValue: string | undefined, onChange?: (v: string) => void) {
  const [own, setOwn] = useState(defaultValue ?? "");
  const current = value ?? own;
  const set = (v: string) => {
    if (value === undefined) setOwn(v);
    onChange?.(v);
  };
  return [current, set] as const;
}

/** Closes a popover on a click outside it or on Escape. */
function useDismiss(open: boolean, ref: React.RefObject<HTMLElement | null>, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, ref, close]);
}

const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const toTime = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** "930", "9:30", "9.30" and "09:30" all mean half past nine; anything else is left as typed. */
function normalizeTime(raw: string) {
  const m = raw.trim().match(/^(\d{1,2})[:.]?(\d{2})?$/);
  if (!m) return raw;
  const h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  if (h > 23 || min > 59) return raw;
  return toTime(h * 60 + min);
}

type FieldProps = {
  name?: string;
  id?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  min?: string;
  max?: string;
  className?: string;
  "aria-label"?: string;
};

export function TimeField({ step = 15, ...props }: FieldProps & { step?: number }) {
  const fine = useFinePointer();
  const [value, setValue] = useFieldValue(props.value, props.defaultValue, props.onChange);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const listId = useId();
  useDismiss(open, box, () => setOpen(false));

  // Keeps the chosen time (or the nearest one) in view when the list opens.
  useEffect(() => {
    if (!open) return;
    list.current?.querySelector<HTMLElement>("[aria-selected=true], [data-near=true]")?.scrollIntoView({ block: "center" });
  }, [open]);

  if (!fine) {
    return (
      <input
        type="time"
        id={props.id}
        name={props.name}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        step={step * 60}
        min={props.min}
        max={props.max}
        required={props.required}
        disabled={props.disabled}
        aria-label={props["aria-label"]}
        className={props.className}
      />
    );
  }

  const from = props.min ? toMinutes(props.min) : 0;
  const to = props.max ? toMinutes(props.max) : 24 * 60 - step;
  const times: string[] = [];
  for (let m = Math.ceil(from / step) * step; m <= to; m += step) times.push(toTime(m));
  const near = value ? times.reduce((a, b) => (Math.abs(toMinutes(b) - toMinutes(value)) < Math.abs(toMinutes(a) - toMinutes(value)) ? b : a), times[0]) : times[0];

  const nudge = (dir: number) => {
    const base = /^\d{2}:\d{2}$/.test(value) ? toMinutes(value) : from;
    setValue(toTime(Math.min(Math.max(base + dir * step, from), to)));
  };

  return (
    <div ref={box} className={`picker ${props.className ?? ""}`}>
      <input
        type="text"
        id={props.id}
        name={props.name}
        value={value}
        inputMode="numeric"
        placeholder="--:--"
        pattern="([01]\d|2[0-3]):[0-5]\d"
        title="Hora en formato HH:MM"
        autoComplete="off"
        required={props.required}
        disabled={props.disabled}
        aria-label={props["aria-label"]}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onChange={(e) => setValue(e.target.value)}
        onBlur={(e) => setValue(normalizeTime(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            nudge(e.key === "ArrowUp" ? 1 : -1);
          } else if (e.key === "Enter" && open) {
            e.preventDefault();
            setValue(normalizeTime(value));
            setOpen(false);
          } else if (e.key === "Tab") {
            setOpen(false);
          }
        }}
        className="picker-input tabular-nums"
      />
      {open && !props.disabled && (
        <ul ref={list} id={listId} role="listbox" className="picker-pop picker-times">
          {times.map((t) => (
            <li
              key={t}
              role="option"
              aria-selected={t === value}
              data-near={t === near || undefined}
              // pointerdown, not click: the input's blur would otherwise run first and close the list.
              onPointerDown={(e) => {
                e.preventDefault();
                setValue(t);
                setOpen(false);
              }}
            >
              {t}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function DateField(props: FieldProps) {
  const fine = useFinePointer();
  const [value, setValue] = useFieldValue(props.value, props.defaultValue, props.onChange);
  const [open, setOpen] = useState(false);
  // The month shown when the grid opens: the chosen day's, else the earliest allowed, else this one.
  const startMonth = () => (value || props.min || todayISO()).slice(0, 7);
  const [month, setMonth] = useState(startMonth);
  const box = useRef<HTMLDivElement>(null);
  useDismiss(open, box, () => setOpen(false));

  if (!fine) {
    return (
      <input
        type="date"
        id={props.id}
        name={props.name}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        min={props.min}
        max={props.max}
        required={props.required}
        disabled={props.disabled}
        aria-label={props["aria-label"]}
        className={props.className}
      />
    );
  }

  const shown = month;
  const { first, last } = monthRange(shown);
  const lead = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7;
  const days = Array.from({ length: Number(last.slice(8, 10)) }, (_, i) => `${shown}-${String(i + 1).padStart(2, "0")}`);
  const allowed = (iso: string) => (!props.min || iso >= props.min) && (!props.max || iso <= props.max);
  const title = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${first}T00:00:00Z`));

  return (
    <div ref={box} className={`picker ${props.className ?? ""}`}>
      {/* The value travels in this field. Not type=hidden, so `required` still stops the form. */}
      <input
        tabIndex={-1}
        aria-hidden="true"
        name={props.name}
        value={value}
        required={props.required}
        onChange={() => {}}
        className="picker-carrier"
      />
      <button
        type="button"
        id={props.id}
        className="picker-input picker-date"
        disabled={props.disabled}
        aria-label={props["aria-label"]}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setMonth(startMonth());
          setOpen((o) => !o);
        }}
      >
        <span className={value ? "" : "text-muted"}>{value ? fmtStaffDate(value, { weekday: "short" }) : "Elegir fecha"}</span>
      </button>
      {open && (
        <div role="dialog" aria-label="Elegir fecha" className="picker-pop picker-calendar">
          <div className="mb-1 flex items-center justify-between">
            <button type="button" className="btn-ghost" aria-label="Mes anterior" onClick={() => setMonth(shiftMonth(shown, -1))}>
              <ArrowIcon direction="left" size={16} />
            </button>
            <strong className="text-sm">{title}</strong>
            <button type="button" className="btn-ghost" aria-label="Mes siguiente" onClick={() => setMonth(shiftMonth(shown, 1))}>
              <ArrowIcon direction="right" size={16} />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center text-sm">
            {HEADS.map((h) => (
              <span key={h} className="pb-1 text-[0.65rem] font-bold uppercase text-muted">
                {h}
              </span>
            ))}
            {lead > 0 && <span style={{ gridColumn: `span ${lead}` }} />}
            {days.map((iso) => (
              <button
                key={iso}
                type="button"
                disabled={!allowed(iso)}
                aria-pressed={iso === value}
                aria-label={fmtStaffDate(iso, { weekday: "long" })}
                className="picker-day"
                onClick={() => {
                  setValue(iso);
                  setOpen(false);
                }}
              >
                {Number(iso.slice(8))}
              </button>
            ))}
          </div>
          {!props.required && value && (
            <button type="button" className="mt-1 text-xs text-muted underline" onClick={() => { setValue(""); setOpen(false); }}>
              Borrar
            </button>
          )}
        </div>
      )}
    </div>
  );
}
