"use client";

import { useEffect } from "react";

/**
 * The last resort: an error thrown by a root layout itself, where no layout is left to render into.
 *
 * It must supply its own `<html>` and `<body>`, and it cannot rely on the stylesheet or the fonts
 * having loaded, which is why the few styles it needs are inline. German, because a failure this
 * deep has no locale left to read.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("global error", error.digest ?? error.message);
  }, [error]);

  return (
    <html lang="de-DE">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "2rem",
          background: "#f5f1e9",
          color: "#152f3b",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          textAlign: "center",
        }}
      >
        <main>
          <h1 style={{ fontSize: "1.6rem", margin: "0 0 .6rem" }}>Da ist etwas schiefgelaufen</h1>
          <p style={{ margin: "0 0 1.6rem", fontSize: ".95rem", lineHeight: 1.7, maxWidth: "34rem" }}>
            Die Seite konnte nicht geladen werden. Bitte versuch es noch einmal. Wenn du reservieren möchtest, ruf uns
            gern direkt an unter <a style={{ color: "inherit" }} href="tel:+4915228087941">+49 152 28087941</a>.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              font: "inherit",
              fontWeight: 700,
              fontSize: ".8rem",
              padding: ".85rem 1.5rem",
              borderRadius: "999px",
              border: 0,
              background: "#152f3b",
              color: "#fffdf8",
              cursor: "pointer",
            }}
          >
            Noch einmal versuchen
          </button>
        </main>
      </body>
    </html>
  );
}
