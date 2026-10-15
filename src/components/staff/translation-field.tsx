"use client";

import { useState } from "react";

const LANGUAGES = [
  { code: "es", name: "Spanisch", field: "description_es", placeholder: "Empanada rellena de carne, cebolla y morrón" },
  { code: "en", name: "Englisch", field: "description_en", placeholder: "Pastry parcel filled with beef, onion and pepper" },
] as const;

/**
 * The Spanish and English description in one input, with a switch above it.
 *
 * Both texts stay in the form (the one not showing is hidden, which still submits), so saving
 * sends both whichever is on screen. A dot on a language's button says there is text stored under
 * it, because with one input showing the other would otherwise look empty.
 */
export function TranslationField({
  id,
  es,
  en,
  className,
}: {
  id: string;
  es: string;
  en: string;
  className?: string;
}) {
  const [active, setActive] = useState<(typeof LANGUAGES)[number]["code"]>("es");
  const [values, setValues] = useState({ es, en });
  return (
    <div className={className}>
      <input type="hidden" name="translations_field" value="1" />
      <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span id={`${id}-tr`} className="text-xs font-bold uppercase tracking-[0.12em] text-muted">
          Übersetzung
        </span>
        <div role="group" aria-labelledby={`${id}-tr`} className="inline-flex rounded-full border border-line bg-white p-0.5 text-xs font-semibold">
          {LANGUAGES.map((l) => {
            const filled = values[l.code].trim() !== "";
            return (
              <button
                key={l.code}
                type="button"
                aria-pressed={active === l.code}
                onClick={() => setActive(l.code)}
                className={`flex min-h-8 items-center gap-1.5 rounded-full px-3 transition-colors ${
                  active === l.code ? "bg-ink text-white" : "text-muted hover:bg-mint hover:text-ink"
                }`}
              >
                {l.name}
                {filled && (
                  <>
                    <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${active === l.code ? "bg-white" : "bg-blue"}`} />
                    <span className="sr-only">(ausgefüllt)</span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>
      {LANGUAGES.map((l) => (
        <input
          key={l.code}
          id={`${id}-${l.code}`}
          name={l.field}
          maxLength={500}
          aria-label={`Beschreibung ${l.name.toLowerCase()}`}
          value={values[l.code]}
          onChange={(e) => setValues((v) => ({ ...v, [l.code]: e.target.value }))}
          placeholder={l.placeholder}
          className={active === l.code ? undefined : "hidden"}
        />
      ))}
    </div>
  );
}
