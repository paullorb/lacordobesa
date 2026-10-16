/**
 * Stands in for `next/cache` outside Next.
 *
 * `cacheLife` and `cacheTag` only annotate a `"use cache"` function: they tell Next how long to keep
 * the entry and which tag invalidates it, and they return nothing. Outside a Next render there is no
 * cache to annotate, so no-ops are the honest stand-in, and the function body, which is the part
 * under test, runs exactly as it would on the server.
 *
 * `updateTag` and `revalidateTag` are recorded rather than dropped: a staff Server Action that
 * changes content has to invalidate the matching tag or the public page keeps serving the old text
 * (see CLAUDE.md), so a test wants to be able to assert that it was called.
 */

/** Every tag passed to updateTag/revalidateTag since the last `clearTags()`, in order. */
export const updatedTags = [];

export function cacheLife() {}

export function cacheTag() {}

export function updateTag(...tags) {
  updatedTags.push(...tags);
}

export function revalidateTag(...tags) {
  updatedTags.push(...tags);
}

export function clearTags() {
  updatedTags.length = 0;
}
