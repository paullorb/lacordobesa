"use client";

import { useEffect } from "react";

/** Registers the service worker that makes the admin installable and shows an offline page. */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    navigator.serviceWorker.register("/sw.js", { scope: "/admin" }).catch(() => {});
  }, []);
  return null;
}
