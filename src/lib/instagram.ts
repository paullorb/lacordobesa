import "server-only";
import { cacheLife } from "next/cache";

/** The last few Instagram posts, so the landing page keeps moving without anybody touching it.
 *
 *  Uses the Instagram Graph API with a long-lived access token. Both env vars are optional: without
 *  them this returns [] and the landing page simply shows its own photos, which is why the feature
 *  can ship before the token exists.
 *
 *  Tokens expire (60 days, refreshable), and an expired token must not take the landing page down
 *  with it: every failure path returns [] and the section disappears. */

const FIELDS = "id,caption,media_type,media_url,permalink,thumbnail_url,timestamp";

export type InstagramPost = {
  id: string;
  caption: string | null;
  url: string;
  image: string;
};

type ApiPost = {
  id: string;
  caption?: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
};

/** Meta retires each Graph API version about two years after release (v21 goes on 2027-01-21), and
 *  a dead version fails quietly here: the feed just falls back to gallery photos. v26.0 shipped on
 *  2026-07-29; bump it when Meta announces its end date, or override it without a deploy through
 *  INSTAGRAM_GRAPH_VERSION. */
const GRAPH_VERSION = process.env.INSTAGRAM_GRAPH_VERSION ?? "v26.0";

export const instagramConfigured = () =>
  Boolean(process.env.INSTAGRAM_ACCESS_TOKEN && process.env.INSTAGRAM_USER_ID);

export async function getInstagramPosts(limit = 6): Promise<InstagramPost[]> {
  "use cache";
  // Posts are not urgent and the token has a rate limit, so an hour-old feed is fine.
  cacheLife("hours");

  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  const userId = process.env.INSTAGRAM_USER_ID;
  if (!token || !userId) return [];

  try {
    const url = new URL(`https://graph.instagram.com/${GRAPH_VERSION}/${userId}/media`);
    url.searchParams.set("fields", FIELDS);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("access_token", token);

    const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    if (!response.ok) return [];
    const body = (await response.json()) as { data?: ApiPost[] };

    return (body.data ?? [])
      .map((post) => ({
        id: post.id,
        caption: post.caption?.trim() ?? null,
        url: post.permalink,
        // A video has no media_url that can be shown as a still, so it uses its thumbnail.
        image: (post.media_type === "VIDEO" ? post.thumbnail_url : post.media_url) ?? "",
      }))
      .filter((post) => post.image !== "")
      .slice(0, limit);
  } catch {
    return [];
  }
}
