import { redirect } from "next/navigation";

/** Sending moved into the Specials page. The route stays so old bookmarks and links keep working.
 *
 *  The fragment matters: the Specials page opens with the creation form and up to fifty offers
 *  above the sending section, so landing at the top loses the thing the link is named after. */
export default function BroadcastPage() {
  redirect("/staff/specials#verschicken");
}
