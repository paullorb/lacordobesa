import Image from "next/image";
import { Suspense } from "react";
import { deleteGalleryItem, saveGalleryItem } from "@/app/admin/actions";
import { ActionForm, ConfirmSubmit, SubmitButton } from "@/components/admin/form-bits";
import { GalleryUpload } from "@/components/admin/gallery-upload";
import { requireStaff } from "@/lib/auth";
import { GALLERY_CATEGORIES } from "@/lib/gallery";

export const metadata = { title: "Galerie" };

export default function AdminGalleryPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Lade …</p>}>
      <AdminGallery />
    </Suspense>
  );
}

async function AdminGallery() {
  const { supabase } = await requireStaff();
  const { data } = await supabase.from("gallery_items").select("*").order("created_at", { ascending: false }).limit(200);
  const items = data ?? [];

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-serif text-3xl">Galerie</h1>
        <p className="text-sm text-muted">Bilder vom Lokal, vom Essen und von Events erscheinen auf der Seite „Galerie“.</p>
      </div>

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
              <div>
                <SubmitButton>Speichern</SubmitButton>
              </div>
            </ActionForm>
            <form action={deleteGalleryItem} className="justify-self-start">
              <input type="hidden" name="id" value={item.id} />
              <ConfirmSubmit message="Dieses Bild löschen?">Löschen</ConfirmSubmit>
            </form>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-muted">Noch keine Bilder.</p>}
      </section>
    </div>
  );
}
