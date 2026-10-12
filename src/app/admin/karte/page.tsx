import { Suspense } from "react";
import { deleteMenuItem, saveCategory, saveMenuItem, toggleMenuItemAvailable } from "@/app/admin/actions";
import { ActionForm, ConfirmSubmit, SubmitButton } from "@/components/admin/form-bits";
import { requireStaff } from "@/lib/auth";
import type { Tables } from "@/lib/database.types";

export const metadata = { title: "Karte" };

export default function MenuPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Lade …</p>}>
      <Menu />
    </Suspense>
  );
}

async function Menu() {
  const { supabase } = await requireStaff();
  const [{ data: categories }, { data: items }] = await Promise.all([
    supabase.from("menu_categories").select("*").order("sort_order"),
    supabase.from("menu_items").select("*").order("sort_order"),
  ]);
  const cats = categories ?? [];

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-serif text-3xl">Karte</h1>
        <p className="text-sm text-muted">
          „Hervorgehoben“ erscheint auf der Startseite. Nicht verfügbare Gerichte werden ausgeblendet, bleiben aber
          hier erhalten.
        </p>
      </div>

      {cats.map((cat) => (
        <section key={cat.id} className="grid gap-3">
          <h2 className="font-semibold">
            {cat.label} <span className="text-xs text-muted">({cat.slug})</span>
          </h2>
          {(items ?? [])
            .filter((i) => i.category_id === cat.id)
            .map((item) => (
              <ItemEditor key={item.id} item={item} categories={cats} />
            ))}
          <details className="card">
            <summary className="cursor-pointer text-sm font-semibold">+ Gericht in „{cat.label}“</summary>
            <ItemForm categories={cats} defaultCategory={cat.id} />
          </details>
        </section>
      ))}

      <details className="card">
        <summary className="cursor-pointer text-sm font-semibold">+ Neue Kategorie</summary>
        <ActionForm action={saveCategory} className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="c-label">Name</label>
            <input id="c-label" name="label" required placeholder="z. B. Bebidas" />
          </div>
          <div>
            <label htmlFor="c-sort">Reihenfolge</label>
            <input id="c-sort" name="sort_order" type="number" defaultValue={cats.length + 1} />
          </div>
          <div className="self-end">
            <SubmitButton>Anlegen</SubmitButton>
          </div>
        </ActionForm>
      </details>
    </div>
  );
}

function ItemEditor({ item, categories }: { item: Tables<"menu_items">; categories: Tables<"menu_categories">[] }) {
  return (
    <details className={`card ${item.is_available ? "" : "opacity-60"}`}>
      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
        <span>
          <strong>{item.name}</strong>
          {item.subtitle && <span className="ml-2 text-xs uppercase tracking-wider text-blue-dark">{item.subtitle}</span>}
          {item.is_featured && <span className="status ml-2 bg-sky-100 text-sky-800">Startseite</span>}
          {!item.is_available && <span className="status ml-2 bg-gray-200 text-gray-600">Nicht verfügbar</span>}
        </span>
        <span className="flex items-center gap-2 text-sm text-muted">
          {item.price_label}
          <form action={toggleMenuItemAvailable}>
            <input type="hidden" name="id" value={item.id} />
            <input type="hidden" name="is_available" value={item.is_available ? "false" : "true"} />
            <button className="btn-ghost">{item.is_available ? "Ausverkauft" : "Wieder da"}</button>
          </form>
        </span>
      </summary>
      <ItemForm categories={categories} item={item} />
    </details>
  );
}

function ItemForm({
  categories,
  item,
  defaultCategory,
}: {
  categories: Tables<"menu_categories">[];
  item?: Tables<"menu_items">;
  defaultCategory?: string;
}) {
  const id = item?.id ?? "new";
  return (
    <div className="mt-4 grid gap-4">
      <ActionForm action={saveMenuItem} className="grid gap-3 sm:grid-cols-2">
        {item && <input type="hidden" name="id" value={item.id} />}
        <div>
          <label htmlFor={`${id}-name`}>Name</label>
          <input id={`${id}-name`} name="name" defaultValue={item?.name} required />
        </div>
        <div>
          <label htmlFor={`${id}-subtitle`}>Untertitel (spanisch)</label>
          <input id={`${id}-subtitle`} name="subtitle" defaultValue={item?.subtitle ?? ""} placeholder="Recién hechas" />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={`${id}-desc`}>Beschreibung</label>
          <textarea id={`${id}-desc`} name="description" rows={2} defaultValue={item?.description ?? ""} />
        </div>
        <div>
          <label htmlFor={`${id}-price`}>Preis (Freitext)</label>
          <input id={`${id}-price`} name="price_label" defaultValue={item?.price_label ?? ""} placeholder="ab 4,50 €" />
        </div>
        <div>
          <label htmlFor={`${id}-cat`}>Kategorie</label>
          <select id={`${id}-cat`} name="category_id" defaultValue={item?.category_id ?? defaultCategory}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-sort`}>Reihenfolge</label>
          <input id={`${id}-sort`} name="sort_order" type="number" defaultValue={item?.sort_order ?? 0} />
        </div>
        <div className="flex items-end gap-5 text-sm">
          <label className="!mb-0 flex items-center gap-2 normal-case tracking-normal">
            <input type="checkbox" name="is_available" defaultChecked={item?.is_available ?? true} /> Verfügbar
          </label>
          <label className="!mb-0 flex items-center gap-2 normal-case tracking-normal">
            <input type="checkbox" name="is_featured" defaultChecked={item?.is_featured ?? false} /> Auf Startseite
          </label>
        </div>
        <div className="sm:col-span-2">
          <SubmitButton>{item ? "Speichern" : "Anlegen"}</SubmitButton>
        </div>
      </ActionForm>
      {item && (
        <form action={deleteMenuItem} className="justify-self-start">
          <input type="hidden" name="id" value={item.id} />
          <ConfirmSubmit message={`„${item.name}“ wirklich löschen?`}>Löschen</ConfirmSubmit>
        </form>
      )}
    </div>
  );
}
