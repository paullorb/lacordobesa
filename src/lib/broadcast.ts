/** The specials list: the channels a guest can pick.
 *
 *  The consent wording lives in the dictionaries (`optin.consent`), because the guest has to read it
 *  in their own language and the stored evidence has to be the sentence they actually saw. It is
 *  snapshotted into `broadcast_optins.consent_text` on subscribe, so editing the wording later cannot
 *  change what an existing subscriber is recorded as having agreed to. */

export const BROADCAST_CHANNELS = ["whatsapp", "email"] as const;
export type BroadcastChannel = (typeof BROADCAST_CHANNELS)[number];

/** The channels the sign-up form offers. A channel belongs here only once its second opt-in step
 *  exists (migration 20261012215041). WhatsApp has one: the guest sends us a message from the number
 *  they entered, and staff confirm the sign-up when it arrives. E-mail would need a confirmation
 *  mail, and no mail sender is configured, so it stays off. subscribe_broadcast() refuses it too. */
export const OPEN_CHANNELS: readonly BroadcastChannel[] = ["whatsapp"];

export const isOpenChannel = (v: string): v is BroadcastChannel => (OPEN_CHANNELS as readonly string[]).includes(v);

export const CHANNEL_LABEL: Record<BroadcastChannel, string> = {
  whatsapp: "WhatsApp",
  email: "E-Mail",
};
