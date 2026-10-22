"use client";

import { useEffect, useRef, useState } from "react";

/** Copies a text to the clipboard and says so.
 *
 *  "Kopiert" is announced through an aria-live region that is in the page from the start (a region
 *  that appears together with its text is not reliably read out). Where the browser refuses the
 *  clipboard, which happens on plain http and in some in-app browsers, the text is offered in a field
 *  and selected, so a long press or Ctrl+C still gets it out. */
export function CopyButton({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "manual">("idle");
  const field = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (state === "manual") field.current?.select();
  }, [state]);

  async function copy() {
    clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
      timer.current = setTimeout(() => setState("idle"), 2500);
    } catch {
      setState("manual");
    }
  }

  return (
    <>
      <button type="button" className="btn-ghost min-h-10" onClick={copy}>
        {state === "copied" ? "Copiado" : label}
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {state === "copied" ? "Copiado" : state === "manual" ? "Enlace seleccionado; copialo manualmente" : ""}
      </span>
      {state === "manual" && (
        <input
          ref={field}
          readOnly
          value={text}
          aria-label="Enlace para invitados"
          className="min-h-10 basis-full text-xs"
          onFocus={(e) => e.currentTarget.select()}
        />
      )}
    </>
  );
}
