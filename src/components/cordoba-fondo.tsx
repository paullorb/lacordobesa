"use client";

import { useEffect } from "react";

const PARAM = "fondo";
const VALUE = "cordoba";
const KEY = "lc-fondo";

/**
 * Trial: the province of Córdoba as a persistent background behind the whole home page.
 *
 * The owners asked to see it, and there are no preview deployments, so it ships to production
 * switched off and turns on only for whoever opens `/?fondo=cordoba` (`?fondo=aus` turns it off
 * again). The choice is kept for the tab in sessionStorage, so clicking around and coming back
 * keeps the look. Regular visitors pay nothing: the map is a CSS background on a rule that only
 * matches `html[data-fondo="cordoba"]`, so the 600 KB SVG is never requested without the flag.
 *
 * Delete this component, its two CSS blocks and the <div className="cordoba-fondo"> in home-view
 * once the owners have decided.
 */
export function CordobaFondo() {
  useEffect(() => {
    const root = document.documentElement;
    let on = false;
    try {
      const param = new URLSearchParams(window.location.search).get(PARAM);
      if (param === VALUE) sessionStorage.setItem(KEY, VALUE);
      else if (param !== null) sessionStorage.removeItem(KEY);
      on = sessionStorage.getItem(KEY) === VALUE;
    } catch {
      on = new URLSearchParams(window.location.search).get(PARAM) === VALUE;
    }
    if (on) root.dataset.fondo = VALUE;
    return () => {
      delete root.dataset.fondo;
    };
  }, []);

  return <div className="cordoba-fondo" aria-hidden="true" />;
}
