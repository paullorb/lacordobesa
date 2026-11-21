import "server-only";
import { createPrivateKey, sign } from "node:crypto";
import { connect, constants, type ClientHttp2Session } from "node:http2";
import { fmtStaffDate } from "@/lib/dates";
import { createPrivilegedClient } from "@/lib/supabase/privileged";

// Push notifications to the staff iPhone app (capacitor.config.ts, docs/mobile-app.md).
//
// Straight to APNs over HTTP/2 with a token-based (.p8) key: no Firebase, no third-party relay, and
// nothing to install. Node's fetch cannot speak to APNs (it needs HTTP/2), so this uses node:http2.
//
// Every send is best effort. A notification is a nudge, not the record: the request is already in
// the database when this runs, and a failure here must never turn a guest's successful booking into
// an error. Callers run it inside after(), so it does not hold up the response either.

export type PushMessage = {
  title: string;
  body: string;
  /** Path inside the staff app the notification opens when tapped. */
  url: string;
};

type ApnsConfig = { keyId: string; teamId: string; privateKey: string; topic: string; host: string };

/** Null when the APNs variables are not set: pushes are then skipped without a word, like mail. */
export function apnsConfig(env: Record<string, string | undefined> = process.env): ApnsConfig | null {
  const keyId = env.APNS_KEY_ID?.trim();
  const teamId = env.APNS_TEAM_ID?.trim();
  // Vercel and .env files both tend to store a multi-line PEM with literal "\n".
  const privateKey = env.APNS_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  if (!keyId || !teamId || !privateKey) return null;
  return {
    keyId,
    teamId,
    privateKey,
    topic: env.APNS_TOPIC?.trim() || "de.lacordobesa.staff",
    // A TestFlight or App Store build only answers to production; an app run from Xcode only to the
    // sandbox. Production is the default because that is what the owners' phones run.
    host: env.APNS_ENV === "development" ? "api.sandbox.push.apple.com" : "api.push.apple.com",
  };
}

const base64url = (input: string | Buffer) => Buffer.from(input).toString("base64url");

/** The provider token APNs wants: an ES256 JWT, valid for an hour, which Apple asks callers to reuse
 *  rather than mint per request (minting too often is answered with TooManyProviderTokenUpdates). */
export function providerToken(config: Pick<ApnsConfig, "keyId" | "teamId" | "privateKey">, nowSeconds: number): string {
  const header = base64url(JSON.stringify({ alg: "ES256", kid: config.keyId }));
  const claims = base64url(JSON.stringify({ iss: config.teamId, iat: nowSeconds }));
  const signature = sign("sha256", Buffer.from(`${header}.${claims}`), {
    key: createPrivateKey(config.privateKey),
    dsaEncoding: "ieee-p1363",
  });
  return `${header}.${claims}.${base64url(signature)}`;
}

let cachedToken: { value: string; keyId: string; issuedAt: number } | null = null;
function currentProviderToken(config: ApnsConfig): string {
  const now = Math.floor(Date.now() / 1000);
  // Renewed after 40 minutes: Apple rejects tokens older than an hour and throttles fresh ones.
  if (!cachedToken || cachedToken.keyId !== config.keyId || now - cachedToken.issuedAt > 40 * 60) {
    cachedToken = { value: providerToken(config, now), keyId: config.keyId, issuedAt: now };
  }
  return cachedToken.value;
}

/** The JSON body APNs delivers. `url` sits beside `aps`, where the app's tap listener reads it. */
export function apnsPayload(message: PushMessage) {
  return {
    aps: { alert: { title: message.title, body: message.body }, sound: "default" },
    url: message.url,
  };
}

/** APNs answers that mean the token will never work again, so its row should go. */
export function isDeadToken(status: number, reason: string | undefined): boolean {
  return status === 410 || (status === 400 && (reason === "BadDeviceToken" || reason === "DeviceTokenNotForTopic"));
}

type SendResult = { token: string; status: number; reason?: string };

function sendOne(session: ClientHttp2Session, config: ApnsConfig, jwt: string, token: string, body: string): Promise<SendResult> {
  return new Promise((resolve) => {
    const req = session.request({
      [constants.HTTP2_HEADER_METHOD]: "POST",
      [constants.HTTP2_HEADER_PATH]: `/3/device/${token}`,
      authorization: `bearer ${jwt}`,
      "apns-topic": config.topic,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    });
    let status = 0;
    let data = "";
    req.setEncoding("utf8");
    req.on("response", (headers) => (status = Number(headers[constants.HTTP2_HEADER_STATUS])));
    req.on("data", (chunk: string) => (data += chunk));
    req.on("end", () => {
      let reason: string | undefined;
      try {
        reason = data ? (JSON.parse(data) as { reason?: string }).reason : undefined;
      } catch {
        // An unreadable body is reported by its status alone.
      }
      resolve({ token, status, reason });
    });
    req.on("error", (error) => resolve({ token, status: 0, reason: error.message }));
    req.setTimeout(10_000, () => req.close(constants.NGHTTP2_CANCEL));
    req.end(body);
  });
}

/** Sends one message to every staff device that switched notifications on. Never throws. */
export async function notifyStaff(message: PushMessage): Promise<void> {
  const config = apnsConfig();
  if (!config) return;
  try {
    const db = createPrivilegedClient();
    const { data: rows, error } = await db.from("staff_push_tokens").select("token");
    if (error) throw error;
    if (!rows?.length) return;

    const jwt = currentProviderToken(config);
    const body = JSON.stringify(apnsPayload(message));
    const session = connect(`https://${config.host}`);
    session.on("error", (e) => console.error("apns session", e));
    let results: SendResult[];
    try {
      results = await Promise.all(rows.map((r) => sendOne(session, config, jwt, r.token, body)));
    } finally {
      session.close();
    }

    const dead = results.filter((r) => isDeadToken(r.status, r.reason)).map((r) => r.token);
    if (dead.length) await db.from("staff_push_tokens").delete().in("token", dead);
    for (const r of results) {
      if (r.status !== 200 && !dead.includes(r.token)) console.error("apns send", r.status, r.reason);
    }
  } catch (error) {
    console.error("notifyStaff", error);
  }
}

// ---------------------------------------------------------------- the three messages
// Staff copy is Argentine Spanish, like the rest of /staff.

export const reservationPush = (r: { name: string; partySize: number; date: string; time: string }): PushMessage => ({
  title: "Nueva reserva",
  body: `${r.name} · ${r.partySize} ${r.partySize === 1 ? "persona" : "personas"} · ${fmtStaffDate(r.date)} ${r.time}`,
  url: `/staff/reservierungen?date=${r.date}`,
});

export const preorderPush = (p: { name: string; date: string; time: string }): PushMessage => ({
  title: "Nuevo pedido",
  body: `${p.name} · retira ${fmtStaffDate(p.date)} ${p.time}`,
  url: "/staff/vorbestellungen",
});

export const inquiryPush = (i: { name: string; occasion: string; date?: string | null }): PushMessage => ({
  title: "Nueva consulta de catering",
  body: [i.name, i.occasion, i.date ? fmtStaffDate(i.date) : null].filter(Boolean).join(" · "),
  url: "/staff/anfragen",
});
