import { redirect } from "next/navigation";

/** Sending moved into the Specials page. The route stays so old bookmarks and links keep working. */
export default function BroadcastPage() {
  redirect("/staff/specials");
}
