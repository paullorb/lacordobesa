"use client";

import { useState } from "react";

/** Copies a block of text to the clipboard. Used for the broadcast list, where the realistic
 *  workflow is pasting numbers into whatever the team already uses to send a group message. */
export function CopyButton({ text, label, count }: { text: string; label: string; count: number }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className="btn-ghost"
      disabled={count === 0}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Clipboard access can be refused (insecure context, denied permission). Saying so beats
          // a button that silently does nothing.
          window.prompt("Kopieren hat nicht geklappt. Hier ist die Liste zum Markieren:", text);
        }
      }}
    >
      {copied ? "Kopiert ✓" : `${label} (${count})`}
    </button>
  );
}
