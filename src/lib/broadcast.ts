/** The specials list: the channels a guest can pick.
 *
 *  The consent wording lives in the dictionaries (`optin.consent`), because the guest has to read it
 *  in their own language and the stored evidence has to be the sentence they actually saw. It is
 *  snapshotted into `broadcast_optins.consent_text` on subscribe, so editing the wording later cannot
 *  change what an existing subscriber is recorded as having agreed to. */

export const BROADCAST_CHANNELS = ["whatsapp", "email"] as const;
export type BroadcastChannel = (typeof BROADCAST_CHANNELS)[number];

/** WhatsApp is confirmed by the guest's own message. E-mail is offered only when the server can
 *  send its confirmation link; callers pass that server-side configuration explicitly. */
export const OPEN_CHANNELS: readonly BroadcastChannel[] = ["whatsapp"];

export const isOpenChannel = (v: string, emailEnabled = false): v is BroadcastChannel =>
  v === "whatsapp" || (v === "email" && emailEnabled);

export const CHANNEL_LABEL: Record<BroadcastChannel, string> = {
  whatsapp: "WhatsApp",
  email: "E-Mail",
};
