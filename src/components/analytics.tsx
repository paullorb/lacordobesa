"use client";

import { usePathname } from "next/navigation";
import { useReportWebVitals } from "next/web-vitals";
import { Suspense, useEffect, useRef } from "react";
import { isStaffPath, MAX_BATCH, VITALS, type AnalyticsEvent, type Beacon, type ClickTarget, type FormName } from "@/lib/analytics";

/** Consent-free analytics, browser half. Mounted once per language in the root document.
 *
 *  What makes it consent-free, in the order a reviewer would check:
 *  - it reads or writes no cookie, localStorage, sessionStorage or IndexedDB, and sets no id;
 *  - it sends one small JSON beacon per page view to our own origin (/api/a), and nothing to a third party;
 *  - what it reads from the device is the viewport width, in three buckets, and `document.referrer`
 *    on the landing page (the server keeps only its host);
 *  - it does nothing at all when the browser sends Do Not Track or Global Privacy Control;
 *  - the server counts into daily totals and keeps no row per visitor (migration 20261015085039).
 *
 *  One request per page view, not one per event. The events of a view (its pageview, the Web Vitals
 *  as they arrive, any clicks and form steps) are queued and leave together when the view ends: the
 *  page is hidden (a tab switch or an unload), or the visitor navigates client-side to the next
 *  path. That is when LCP, CLS and INP are final anyway, so sending earlier would only split one
 *  view into several requests. `sendBeacon` exists for exactly this moment: the browser carries the
 *  request through unload. tests/e2e/perf.test.mjs counts requests per page and fails on a second.
 *
 *  Failing is silent: `sendBeacon` returns false or throws on a blocked request, and nobody notices. */

function optedOut() {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.doNotTrack === "1" || nav.globalPrivacyControl === true;
}

let landed = false;
const reported = new Set<string>();
const queue: Beacon[] = [];

/** Record one event. Safe to call anywhere on the client; does nothing on the server, in the staff area,
 *  or for a visitor who has asked not to be tracked. The event is queued and sent with the rest of the
 *  page view's events, see `flush`. */
export function track(event: AnalyticsEvent, detail = "") {
  if (typeof window === "undefined" || optedOut() || isStaffPath(location.pathname)) return;
  const beacon: Beacon = { e: event, d: detail, p: location.pathname, w: window.innerWidth };
  // The outside referrer belongs to the first page of a visit. Later pageviews are client-side
  // navigations whose referrer is our own previous page, which the server would drop anyway.
  if (event === "pageview" && !landed) beacon.r = document.referrer;
  if (event === "pageview") landed = true;
  queue.push(beacon);
  // The server refuses a bigger batch, so a page that somehow produces one sends early rather than
  // losing it all. In practice a view queues a pageview, five vitals and a handful of clicks.
  if (queue.length >= MAX_BATCH) flush();
}

/** Send everything queued so far as one request. */
function flush() {
  if (queue.length === 0) return;
  const body = JSON.stringify(queue.splice(0));
  try {
    navigator.sendBeacon("/api/a", body);
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
  // double-invoked effect in development. A new path ends the previous view, whose events go out
  // before the new one starts queueing its own.
  useEffect(() => {
    if (last.current === pathname || (document.visibilityState as string) === "prerender") return;
    last.current = pathname;
    flush();
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

  // The view ends when the page becomes hidden: a tab switch, or an unload, which hides the page too.
  // web-vitals reports LCP, CLS and INP from a capture-phase `visibilitychange` listener on window,
  // which runs before this one on document, so the batch already holds them. Not `pagehide`: an
  // unload fires it before `visibilitychange`, so a flush there would send the view in two halves.
  // A tab that comes back and produces more events sends them in a later request, on purpose:
  // queueing a second pageview on return would count the same visit twice, and the counters are
  // per event, so a click needs no pageview beside it in the same request.
  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === "hidden") flush();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

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
