"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { onPushTap } from "@/lib/native-push-client";

/** Opens the staff page a tapped notification points at. Mounted in the root document, because the
 *  iPhone app starts on the public site, so a tap can arrive before any staff page is open. Outside
 *  the app there is no plugin and it does nothing. */
export function NativePushTapHandler() {
  const router = useRouter();
  useEffect(() => onPushTap((url) => router.push(url)), [router]);
  return null;
}
