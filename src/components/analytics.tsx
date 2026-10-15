"use client";

import { usePathname } from "next/navigation";
import { useReportWebVitals } from "next/web-vitals";
import { Suspense, useEffect, useRef } from "react";
import { isStaffPath, VITALS, type AnalyticsEvent, type Beacon, type ClickTarget, type FormName } from "@/lib/analytics";

/** Consent-free analytics, browser half. Mounted once per language in the root document.
 *
 *  What makes it consent-free, in the order a reviewer would check:
 *  - it reads or writes no cookie, localStorage, sessionStorage or IndexedDB, and sets no id;
 *  - it sends one small JSON beacon to our own origin (/api/a), and nothing to a third party;
 *  - what it reads from the device is the viewport width, in three buckets, and `document.referrer`
 *    on the landing page (the server keeps only its host);
 *  - it does nothing at all when the browser sends Do Not Track or Global Privacy Control;
 *  - the server counts into daily totals and keeps no row per visitor (migration 20261015085039).
 *
 *  Failing is silent: `sendBeacon` returns false or throws on a blocked request, and nobody notices. */

function optedOut() {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.doNotTrack === "1" || nav.globalPrivacyControl === true;
}

let landed = false;
const reported = new Set<string>();

/** Fire one event. Safe to call anywhere on the client; does nothing on the server, in the staff area,
 *  or for a visitor who has asked not to be tracked. */
export function track(event: AnalyticsEvent, detail = "") {
  if (typeof window === "undefined" || optedOut() || isStaffPath(location.pathname)) return;
  const beacon: Beacon = { e: event, d: detail, p: location.pathname, w: window.innerWidth };
  // The outside referrer belongs to the first page of a visit. Later pageviews are client-side
  // navigations whose referrer is our own previous page, which the server would drop anyway.
  if (event === "pageview" && !landed) beacon.r = document.referrer;
  if (event === "pageview") landed = true;
  try {
    navigator.sendBeacon("/api/a", JSON.stringify(beacon));
  } catch {
    // Analytics never gets to throw into the page.
  }
}

/** What a link points at, for the contact clicks the shop cares about. */
function clickTarget(a: HTMLAnchorElement): ClickTarget | null {
  const href = a.getAttribute("href") ?? "";
  if (href.startsWith("tel:")) return "phone";
  if (href.startsWith("mailto:")) return "email";
  let host = "";
  try {
    host = new URL(href, location.href).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
  if (host === "wa.me" || host === "api.whatsapp.com") return "whatsapp";
  if (host === "instagram.com") return "instagram";
  if (host === "maps.app.goo.gl" || host === "maps.google.com" || (host === "google.com" && href.includes("/maps"))) return "maps";
  return null;
}

function Tracker() {
  const pathname = usePathname();
  const last = useRef<string | null>(null);

  // A pageview per path, including client-side navigations. The ref also swallows React's
  // double-invoked effect in development.
  useEffect(() => {
    if (last.current === pathname || (document.visibilityState as string) === "prerender") return;
    last.current = pathname;
    track("pageview");
  }, [pathname]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const a = e.target instanceof Element ? e.target.closest("a") : null;
      const target = a && clickTarget(a);
      if (target) track("click", target);
      if (e.target instanceof Element && e.target.closest("[data-track='map_load']")) track("map_load");
    }
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  // Already bucketed by the browser's own good / needs-improvement / poor thresholds, so only the
  // rating leaves the page, not the measured value.
  // One report per metric per page. Next hands the same measurement to every registered callback, and
  // the two effects React runs in development register two, so without this each vital counts twice.
  useReportWebVitals((metric) => {
    if (!(VITALS as readonly string[]).includes(metric.name)) return;
    const key = `${metric.name}:${location.pathname}`;
    if (reported.has(key)) return;
    reported.add(key);
    track("vital", `${metric.name}:${metric.rating}`);
  });

  return null;
}

export function Analytics() {
  // usePathname on a dynamic route would otherwise opt the whole shell out of static rendering.
  return (
    <Suspense fallback={null}>
      <Tracker />
    </Suspense>
  );
}

/** Reports a form's lifecycle from the state `useActionState` already holds: a submit when it goes
 *  pending, then success or failure when the result arrives. No field value is ever read. */
export function useTrackForm(form: FormName, state: { ok: boolean } | null, pending: boolean) {
  const wasPending = useRef(false);
  useEffect(() => {
    if (pending && !wasPending.current) track("form_submit", form);
    wasPending.current = pending;
  }, [pending, form]);
  useEffect(() => {
    if (state) track(state.ok ? "form_success" : "form_error", form);
  }, [state, form]);
}
