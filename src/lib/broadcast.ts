/** The specials list: the channels a guest can pick.
 *
 *  The consent wording lives in the dictionaries (`optin.consent`), because the guest has to read it
 *  in their own language and the stored evidence has to be the sentence they actually saw. It is
 *  snapshotted into `broadcast_optins.consent_text` on subscribe, so editing the wording later cannot
 *  change what an existing subscriber is recorded as having agreed to. */

export const BROADCAST_CHANNELS = ["whatsapp", "email"] as const;
export type BroadcastChannel = (typeof BROADCAST_CHANNELS)[number];

export const isBroadcastChannel = (v: string): v is BroadcastChannel =>
  (BROADCAST_CHANNELS as readonly string[]).includes(v);

export const CHANNEL_LABEL: Record<BroadcastChannel, string> = {
  whatsapp: "WhatsApp",
  email: "E-Mail",
};
