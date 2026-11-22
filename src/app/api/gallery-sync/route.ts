import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";
import { ALBUM_SOURCE, isJpeg, isSourceId, parseAlbumCaption, syncAuthorized } from "@/lib/album-sync";
import { TAG } from "@/lib/data";
import { createPrivilegedClient } from "@/lib/supabase/privileged";

/** Import endpoint for the owners' shared photo album (scripts/sync-album.mjs, run by
 *  .github/workflows/sync-album.yml).
 *
 *  The script holds one bearer token and nothing else: no Supabase key, no staff login. It asks
 *  which album photos the site already knows (GET), then sends each new one, already resized and
 *  branded, as one request (POST). Everything that decides what is stored happens here.
 *
 *  A photo is claimed in `gallery_imports` *before* it is stored, so two overlapping runs cannot
 *  both add it, and the claim outlives the gallery item: a photo staff deleted stays deleted.
 *
 *  Without GALLERY_SYNC_TOKEN every request is a 404, the same answer a route that does not exist gives. */

/** Vercel refuses a request body over 4.5 MB before it reaches this code; the script stays under this. */
const MAX_BYTES = 4 * 1024 * 1024;

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });
const denied = () => new Response(null, { status: 404 });

export async function GET(request: NextRequest) {
  if (!syncAuthorized(request.headers.get("authorization"))) return denied();
  // Paged: the API answers with at most `max_rows` (1000, supabase/config.toml) rows whatever the limit
  // says, and an id missing here would be sent again on every run.
  const supabase = createPrivilegedClient();
  const known: string[] = [];
  for (;;) {
    const { data, error } = await supabase
      .from("gallery_imports")
      .select("source_id")
      .eq("source", ALBUM_SOURCE)
      .order("source_id")
      .range(known.length, known.length + 999);
    if (error) return json({ error: error.message }, 500);
    if (data.length === 0) return json({ known });
    known.push(...data.map((row) => row.source_id));
  }
}

export async function POST(request: NextRequest) {
  if (!syncAuthorized(request.headers.get("authorization"))) return denied();

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "expected multipart/form-data" }, 400);
  }
  const sourceId = String(form.get("source_id") ?? "");
  const file = form.get("file");
  if (!isSourceId(sourceId)) return json({ error: "bad source_id" }, 400);
  if (!(file instanceof File) || file.size === 0) return json({ error: "no file" }, 400);
  if (file.size > MAX_BYTES) return json({ error: "file too large" }, 413);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isJpeg(bytes)) return json({ error: "not a JPEG" }, 415);
  const { caption, category } = parseAlbumCaption(String(form.get("caption") ?? ""));

  const supabase = createPrivilegedClient();
  const key = { source: ALBUM_SOURCE, source_id: sourceId };

  // The claim. 23505 is the primary key saying another run (or an earlier one) has this photo.
  const { error: claimError } = await supabase.from("gallery_imports").insert(key);
  if (claimError?.code === "23505") return json({ status: "exists" });
  if (claimError) return json({ error: claimError.message }, 500);
  // From here a failure gives the claim back, so the next run tries the photo again.
  const release = () => supabase.from("gallery_imports").delete().match(key);

  const path = `album/${crypto.randomUUID()}.jpg`;
  const { error: uploadError } = await supabase.storage.from("gallery").upload(path, bytes, { contentType: "image/jpeg" });
  if (uploadError) {
    await release();
    return json({ error: uploadError.message }, 500);
  }
  const { data: item, error: insertError } = await supabase
    .from("gallery_items")
    .insert({
      image_url: supabase.storage.from("gallery").getPublicUrl(path).data.publicUrl,
      storage_path: path,
      caption,
      category,
      cursor_cheer: category === "food",
    })
    .select("id")
    .single();
  if (insertError) {
    await supabase.storage.from("gallery").remove([path]);
    await release();
    return json({ error: insertError.message }, 500);
  }
  const { error: linkError } = await supabase.from("gallery_imports").update({ gallery_item_id: item.id }).match(key);
  if (linkError) console.error("gallery-sync: link", linkError);

  // Not updateTag: that is for Server Actions. "max" serves the cached gallery once more while the
  // new one is fetched, which is the right trade for a photo nobody is waiting on.
  revalidateTag(TAG.gallery, "max");
  return json({ status: "added", id: item.id, category }, 201);
}
