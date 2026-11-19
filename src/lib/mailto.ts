/** A `mailto:` link to a guest's address.
 *
 *  The address is guest input and the database check on it allows `?`, `&` and `%` (it only wants
 *  an `@` and a dot). Dropped raw into `mailto:${email}`, `a@b.de?bcc=someone@else.com` adds a
 *  recipient and `?body=` rewrites the message, so a guest could make a staff member's mail client
 *  send something other than what they thought they were opening. Encoded, those characters stay
 *  part of the address. The `@` is left readable, as RFC 6068 allows. */
export function mailtoHref(address: string, params?: Record<string, string>): string {
  const recipient = encodeURIComponent(address).replace(/%40/g, "@");
  const query = params
    ? Object.entries(params)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join("&")
    : "";
  return `mailto:${recipient}${query ? `?${query}` : ""}`;
}
