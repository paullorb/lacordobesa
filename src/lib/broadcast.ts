/** The specials list: channels, and the consent wording that gets stored with every opt-in.
 *
 *  CONSENT_TEXT is the evidence. It is snapshotted into broadcast_optins.consent_text on subscribe,
 *  so a later edit here cannot change what an existing subscriber is recorded as having agreed to.
 *  That means: when you change this wording, you are writing the wording for *future* opt-ins only. */

export const BROADCAST_CHANNELS = ["whatsapp", "email"] as const;
export type BroadcastChannel = (typeof BROADCAST_CHANNELS)[number];

export const isBroadcastChannel = (v: string): v is BroadcastChannel =>
  (BROADCAST_CHANNELS as readonly string[]).includes(v);

export const CHANNEL_LABEL: Record<BroadcastChannel, string> = {
  whatsapp: "WhatsApp",
  email: "E-Mail",
};

export const CONSENT_TEXT: Record<BroadcastChannel, string> = {
  whatsapp:
    "Ich möchte von La Cordobesa per WhatsApp über Specials und Aktionen informiert werden. Ich kann mich jederzeit über den Link in der Nachricht abmelden.",
  email:
    "Ich möchte von La Cordobesa per E-Mail über Specials und Aktionen informiert werden. Ich kann mich jederzeit über den Link in der E-Mail abmelden.",
};
