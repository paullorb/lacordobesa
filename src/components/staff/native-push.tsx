"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { removePushToken, savePushToken } from "@/app/staff/push-actions";
import {
  onPushTap,
  pushPermission,
  pushPlugin,
  requestPushToken,
  storePushToken,
  storedPushToken,
  unregisterDevice,
} from "@/lib/native-push-client";

type State = "hidden" | "off" | "on" | "busy" | "blocked";

/**
 * "Avisos en este iPhone": the switch for push notifications, on the dashboard.
 *
 * Renders nothing outside the iPhone app (Safari, a laptop, the installed PWA), so the web pages
 * look exactly as before. Inside the app it offers to switch on until it is on, then stays as a
 * small line that can switch off again.
 */
export function NativePushCard() {
  const [state, setState] = useState<State>("hidden");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const plugin = pushPlugin();
    if (!plugin) return;
    let live = true;
    void (async () => {
      const permission = await pushPermission(plugin);
      const token = storedPushToken();
      if (!live) return;
      if (permission === "denied") return setState("blocked");
      if (permission === "granted" && token) {
        setState("on");
        // The row may be gone (someone else signed in on this phone, or Apple retired the token):
        // registering again is idempotent and puts it back under whoever is signed in now.
        void savePushToken(token);
      } else setState("off");
    })();
    return () => {
      live = false;
    };
  }, []);

  async function enable() {
    const plugin = pushPlugin();
    if (!plugin) return;
    setState("busy");
    setError(null);
    try {
      const token = await requestPushToken(plugin);
      const { ok } = await savePushToken(token);
      if (!ok) throw new Error("save");
      storePushToken(token);
      setState("on");
    } catch (e) {
      if (e instanceof Error && e.message === "permission") return setState("blocked");
      setError("No se pudieron activar los avisos. Probá de nuevo en un momento.");
      setState("off");
    }
  }

  async function disable() {
    setState("busy");
    const token = storedPushToken();
    if (token) await removePushToken(token).catch(() => undefined);
    storePushToken(null);
    await unregisterDevice(pushPlugin());
    setState("off");
  }

  if (state === "hidden") return null;

  if (state === "on" || (state === "busy" && storedPushToken())) {
    return (
      <p className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
        <span>🔔 Avisos activados en este iPhone: reservas, pedidos y consultas nuevas.</span>
        <button type="button" className="btn-ghost text-xs" onClick={disable} disabled={state === "busy"}>
          Desactivar
        </button>
      </p>
    );
  }

  return (
    <section className="card border-sky-200 bg-sky-50">
      <h2 className="font-semibold">Avisos en este iPhone</h2>
      {state === "blocked" ? (
        <p className="mt-1 text-sm text-muted">
          Los avisos están desactivados para la app. Activalos en Ajustes → Notificaciones → La Cordobesa.
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted">
            Recibí un aviso cada vez que llega una reserva, un pedido o una consulta de catering.
          </p>
          <button type="button" className="btn-primary mt-3" onClick={enable} disabled={state === "busy"}>
            {state === "busy" ? "Activando …" : "Activar avisos"}
          </button>
          {error && (
            <p role="alert" className="mt-2 text-sm text-red-700">
              {error}
            </p>
          )}
        </>
      )}
    </section>
  );
}

/** Opens the page a tapped notification points at. Mounted once in the staff layout. */
export function NativePushTapHandler() {
  const router = useRouter();
  useEffect(() => onPushTap((url) => router.push(url)), [router]);
  return null;
}
