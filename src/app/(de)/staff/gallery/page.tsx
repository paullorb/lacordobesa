import Image from "next/image";
import { Suspense } from "react";
import { StaffLoading } from "@/components/staff/card-bits";
import { deleteGalleryItem, saveGalleryItem, setHeroImage } from "@/app/staff/actions";
import { ActionForm, ConfirmSubmit, SubmitButton } from "@/components/staff/form-bits";
import { GalleryUpload } from "@/components/staff/gallery-upload";
import { requireStaff } from "@/lib/auth";
import { GALLERY_CATEGORIES } from "@/lib/gallery";

export const metadata = { title: "Galerie" };

export default function StaffGalleryPage() {
  return (
    <Suspense fallback={<StaffLoading />}>
      <StaffGallery />
    </Suspense>
  );
}

async function StaffGallery() {
  const { supabase } = await requireStaff();
  const [{ data }, { data: heroSetting }] = await Promise.all([
    supabase.from("gallery_items").select("*").order("created_at", { ascending: false }).limit(200),
    supabase.from("site_settings").select("value").eq("key", "hero").maybeSingle(),
  ]);
  const items = data ?? [];
  const heroId = (heroSetting?.value as { gallery_item_id?: string } | null)?.gallery_item_id ?? null;
  // The is_featured column and the hero controls arrive with migration 20261012101400.
  const featuredColumn =
    items.length > 0
      ? typeof items[0].is_featured === "boolean"
      : !(await supabase.from("gallery_items").select("is_featured").limit(1)).error;

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-serif text-3xl">Galerie</h1>
        <p className="text-sm text-muted">
          Bilder vom Lokal, vom Essen und von Events erscheinen auf der Seite „Galerie“. „Auf der Startseite“ nimmt ein
          Bild zusätzlich in den Bilderstreifen der Startseite auf, „Als Hauptbild“ macht es zum großen Bild im Bereich
          „Besuch uns“.
        </p>
      </div>

      {!featuredColumn && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Startseiten-Bilder und Hauptbild sind erst verfügbar, sobald die Datenbank-Migration 20261012101400
          eingespielt ist.
        </p>
      )}

      <section className="card">
        <h2 className="mb-3 font-semibold">Neues Bild</h2>
        <GalleryUpload />
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.id} className="card grid gap-3">
            <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-mint">
              <Image src={item.image_url} alt={item.caption ?? "Galeriebild"} fill sizes="(max-width: 640px) 100vw, 400px" className="object-cover" />
            </div>
            {featuredColumn && item.id === heroId && (
              <p className="text-xs font-semibold text-emerald-700">Hauptbild auf der Startseite</p>
            )}
            <ActionForm action={saveGalleryItem} className="grid gap-2">
              <input type="hidden" name="id" value={item.id} />
              <div>
                <label htmlFor={`${item.id}-caption`}>Bildunterschrift</label>
                <input id={`${item.id}-caption`} name="caption" defaultValue={item.caption ?? ""} maxLength={160} />
              </div>
              <div>
                <label htmlFor={`${item.id}-cat`}>Kategorie</label>
                <select id={`${item.id}-cat`} name="category" defaultValue={item.category}>
                  {GALLERY_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <label className="!mb-0 flex items-center gap-2 text-sm normal-case tracking-normal">
                <input type="checkbox" name="cursor_cheer" defaultChecked={item.cursor_cheer ?? item.category === "food"} /> Mauszeiger
                „¡Ñam!“ über dem Bild (für Essen)
              </label>
              {featuredColumn && (
                <>
                  <input type="hidden" name="featured_field" value="1" />
                  <label className="!mb-0 flex items-center gap-2 text-sm normal-case tracking-normal">
                    <input type="checkbox" name="is_featured" defaultChecked={item.is_featured ?? false} /> Auf der
                    Startseite zeigen
                  </label>
                </>
              )}
              <div>
                <SubmitButton>Speichern</SubmitButton>
              </div>
            </ActionForm>
            <div className="flex flex-wrap gap-2">
              {featuredColumn && item.id !== heroId && (
                <form action={setHeroImage}>
                  <input type="hidden" name="id" value={item.id} />
                  <button className="btn-ghost">Als Hauptbild</button>
                </form>
              )}
              {featuredColumn && item.id === heroId && (
                <form action={setHeroImage}>
                  {/* No id clears the choice, so the bundled image comes back. */}
                  <button className="btn-ghost">Hauptbild entfernen</button>
                </form>
              )}
              <form action={deleteGalleryItem}>
                <input type="hidden" name="id" value={item.id} />
                <ConfirmSubmit message="Dieses Bild löschen?">Löschen</ConfirmSubmit>
              </form>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-muted">Noch keine Bilder.</p>}
      </section>
    </div>
  );
}
