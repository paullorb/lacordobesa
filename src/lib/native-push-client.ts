// Push inside the staff iPhone app (capacitor.config.ts). The site never imports @capacitor/*: the
// browser would pay for code it cannot use. It reaches the plugin through the `window.Capacitor`
// global the app injects instead, so in Safari or any other browser all of this is simply absent.
//
// Bridge calls are awaited, never chained: the injected bridge hands back some results (listener
// handles) synchronously although the plugin's types say Promise. muk.events shipped a crash to
// TestFlight by trusting the types.

type MaybeAsync<T> = T | Promise<T>;
type Handle = { remove: () => MaybeAsync<void> };

type PushPlugin = {
  checkPermissions: () => MaybeAsync<{ receive: string }>;
  requestPermissions: () => MaybeAsync<{ receive: string }>;
  register: () => MaybeAsync<void>;
  unregister?: () => MaybeAsync<void>;
  addListener(event: "registration", cb: (t: { value?: string }) => void): MaybeAsync<Handle>;
  addListener(event: "registrationError", cb: (e: { error?: string }) => void): MaybeAsync<Handle>;
  addListener(
    event: "pushNotificationActionPerformed",
    cb: (a: { notification?: { data?: Record<string, unknown> } }) => void,
  ): MaybeAsync<Handle>;
};

type Bridge = { isNativePlatform?: () => boolean; Plugins?: { PushNotifications?: PushPlugin } };

/** The token this device registered, so switching off and signing out can remove that row. */
export const PUSH_TOKEN_KEY = "cordobesa:push-token";

export function pushPlugin(): PushPlugin | null {
  if (typeof window === "undefined") return null;
  const bridge = (window as { Capacitor?: Bridge }).Capacitor;
  if (!bridge?.isNativePlatform?.()) return null;
  return bridge.Plugins?.PushNotifications ?? null;
}

export function storedPushToken(): string | null {
  try {
    return window.localStorage.getItem(PUSH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function storePushToken(token: string | null) {
  try {
    if (token) window.localStorage.setItem(PUSH_TOKEN_KEY, token);
    else window.localStorage.removeItem(PUSH_TOKEN_KEY);
  } catch {
    // Without storage the switch just cannot remember its state.
  }
}

async function settle<T>(value: MaybeAsync<T> | undefined): Promise<T | undefined> {
  try {
    return await value;
  } catch {
    return undefined;
  }
}

export type PushPermission = "granted" | "denied" | "prompt";

export async function pushPermission(plugin: PushPlugin): Promise<PushPermission> {
  const { receive } = (await settle(plugin.checkPermissions())) ?? { receive: "denied" };
  return receive === "granted" ? "granted" : receive === "denied" ? "denied" : "prompt";
}

/** Asks for permission if needed, registers with APNs and resolves with the device token.
 *  register() returns before Apple answers; the token arrives as an event, with a timeout so a
 *  silent failure cannot leave the switch spinning. */
export async function requestPushToken(plugin: PushPlugin): Promise<string> {
  let { receive } = await plugin.checkPermissions();
  if (receive !== "granted") ({ receive } = await plugin.requestPermissions());
  if (receive !== "granted") throw new Error("permission");

  return new Promise<string>((resolve, reject) => {
    const handles: Handle[] = [];
    let done = false;
    const finish = () => {
      done = true;
      window.clearTimeout(timer);
      while (handles.length) void settle(handles.pop()?.remove());
    };
    const track = (h: MaybeAsync<Handle>) =>
      void settle(h).then((handle) => {
        if (!handle) return;
        if (done) void settle(handle.remove());
        else handles.push(handle);
      });
    const timer = window.setTimeout(() => {
      finish();
      reject(new Error("timeout"));
    }, 15_000);
    track(
      plugin.addListener("registration", ({ value }) => {
        finish();
        if (value) resolve(value);
        else reject(new Error("registration"));
      }),
    );
    track(
      plugin.addListener("registrationError", () => {
        finish();
        reject(new Error("registration"));
      }),
    );
    void settle(plugin.register());
  });
}

/** Calls back with the path of a notification that was tapped; returns the unsubscribe. */
export function onPushTap(onTap: (url: string) => void): () => void {
  const plugin = pushPlugin();
  if (!plugin) return () => {};
  let handle: Handle | undefined;
  let cancelled = false;
  void settle(
    plugin.addListener("pushNotificationActionPerformed", (action) => {
      const url = action?.notification?.data?.url;
      // Only paths inside the staff app: a payload is not a licence to open anything.
      if (typeof url === "string" && url.startsWith("/staff")) onTap(url);
    }),
  ).then((h) => {
    if (cancelled) void settle(h?.remove());
    else handle = h;
  });
  return () => {
    cancelled = true;
    void settle(handle?.remove());
  };
}

export async function unregisterDevice(plugin: PushPlugin | null) {
  await settle(plugin?.unregister?.());
}
