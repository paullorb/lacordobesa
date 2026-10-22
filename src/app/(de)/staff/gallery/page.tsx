import Image from "next/image";
import { Suspense } from "react";
import { StaffLoading } from "@/components/staff/card-bits";
import { deleteGalleryItem, saveGalleryItem, setHeroImage } from "@/app/staff/actions";
import { ActionForm, ConfirmSubmit, SubmitButton } from "@/components/staff/form-bits";
import { GalleryUpload } from "@/components/staff/gallery-upload";
import { requireStaff } from "@/lib/auth";
import { GALLERY_CATEGORIES, STAFF_GALLERY_LABELS } from "@/lib/gallery";

export const metadata = { title: "Galería" };

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

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-serif text-3xl">Galería</h1>
        <p className="text-sm text-muted">
          Estas fotos aparecen en «Galería». «Mostrar en el inicio» añade una foto a la franja de imágenes;
          «Usar como imagen principal» la muestra en grande.
        </p>
      </div>

      <section className="card">
        <h2 className="mb-3 font-semibold">Nueva foto</h2>
        <GalleryUpload />
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.id} className="card grid gap-3">
            <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-mint">
              <Image src={item.image_url} alt={item.caption ?? "Foto de la galería"} fill sizes="(max-width: 640px) 100vw, 400px" className="object-cover" />
            </div>
            {item.id === heroId && (
              <p className="text-xs font-semibold text-emerald-700">Imagen principal del inicio</p>
            )}
            <ActionForm action={saveGalleryItem} className="grid gap-2">
              <input type="hidden" name="id" value={item.id} />
              <div>
                <label htmlFor={`${item.id}-caption`}>Texto de la foto</label>
                <input id={`${item.id}-caption`} name="caption" defaultValue={item.caption ?? ""} maxLength={160} />
              </div>
              <div>
                <label htmlFor={`${item.id}-cat`}>Categoría</label>
                <select id={`${item.id}-cat`} name="category" defaultValue={item.category}>
                  {GALLERY_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {STAFF_GALLERY_LABELS[c.value]}
                    </option>
                  ))}
                </select>
              </div>
              <label className="!mb-0 flex items-center gap-2 text-sm normal-case tracking-normal">
                <input type="checkbox" name="is_featured" defaultChecked={item.is_featured ?? false} /> Mostrar en el inicio
              </label>
              <div>
                <SubmitButton>Guardar</SubmitButton>
              </div>
            </ActionForm>
            <div className="flex flex-wrap gap-2">
              {item.id !== heroId && (
                <form action={setHeroImage}>
                  <input type="hidden" name="id" value={item.id} />
                  <button className="btn-ghost">Usar como imagen principal</button>
                </form>
              )}
              {item.id === heroId && (
                <form action={setHeroImage}>
                  {/* No id clears the choice, so the bundled image comes back. */}
                  <button className="btn-ghost">Quitar imagen principal</button>
                </form>
              )}
              <form action={deleteGalleryItem}>
                <input type="hidden" name="id" value={item.id} />
                <ConfirmSubmit message="¿Eliminar esta foto?">Eliminar</ConfirmSubmit>
              </form>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-muted">Todavía no hay fotos.</p>}
      </section>
    </div>
  );
}
