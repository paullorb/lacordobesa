import { Suspense } from "react";
import { deleteCategory, deleteMenuItem, saveCategory, saveMenuItem, toggleMenuItemAvailable } from "@/app/admin/actions";
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
    supabase.from("menu_items").select("*").order("sort_order").order("name"),
  ]);
  const cats = categories ?? [];
  const all = items ?? [];

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-serif text-3xl">Karte</h1>
        <p className="text-sm text-muted">
          Klick auf ein Gericht, um Name, Beschreibung (deutsche Übersetzung) und Preis zu ändern. „Startseite“
          markiert die drei Highlights oben auf der Website; „Ausverkauft“ blendet ein Gericht aus, ohne es zu löschen.
        </p>
      </div>

      {cats.length > 0 && typeof cats[0].show_prices !== "boolean" && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Die Option „Preise anzeigen“ ist erst verfügbar, sobald die Datenbank-Migration 0008 eingespielt ist.
        </p>
      )}

      <nav className="flex flex-wrap gap-1 text-xs">
        {cats.map((c) => (
          <a key={c.id} href={`#cat-${c.slug}`} className="rounded-full border border-line bg-white px-2.5 py-1 hover:bg-mint">
            {c.label} <span className="text-muted">({all.filter((i) => i.category_id === c.id).length})</span>
          </a>
        ))}
      </nav>

      {cats.map((cat) => {
        const catItems = all.filter((i) => i.category_id === cat.id);
        return (
          <section key={cat.id} id={`cat-${cat.slug}`} className="grid gap-2 scroll-mt-28">
            <details className="group">
              <summary className="flex cursor-pointer flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line pb-2">
                <h2 className="font-serif text-xl">{cat.label}</h2>
                {cat.label_secondary && <span className="text-xs uppercase tracking-wider text-blue-dark">{cat.label_secondary}</span>}
                {cat.note && <span className="text-xs italic text-muted">{cat.note}</span>}
                {cat.show_prices === false && <span className="status bg-amber-100 text-amber-800">Preise ausgeblendet</span>}
                <span className="ml-auto text-xs text-muted group-open:hidden">Kategorie bearbeiten ▾</span>
              </summary>
              <div className="card mt-2 grid gap-4">
                <CategoryForm cat={cat} />
                {catItems.length === 0 && (
                  <form action={deleteCategory} className="justify-self-start">
                    <input type="hidden" name="id" value={cat.id} />
                    <ConfirmSubmit message={`Kategorie „${cat.label}“ löschen?`}>Kategorie löschen</ConfirmSubmit>
                  </form>
                )}
              </div>
            </details>

            <div className="grid gap-1.5">
              {catItems.map((item) => (
                <ItemRow key={item.id} item={item} categories={cats} />
              ))}
            </div>
            <details className="rounded-md border border-dashed border-line px-3 py-2">
              <summary className="cursor-pointer text-sm font-semibold text-blue-dark">+ Gericht in „{cat.label}“</summary>
              <ItemForm categories={cats} defaultCategory={cat.id} nextSort={(catItems.at(-1)?.sort_order ?? 0) + 1} />
            </details>
          </section>
        );
      })}

      <details className="card">
        <summary className="cursor-pointer text-sm font-semibold">+ Neue Kategorie</summary>
        <CategoryForm nextSort={(cats.at(-1)?.sort_order ?? 0) + 1} />
      </details>
    </div>
  );
}

function CategoryForm({ cat, nextSort }: { cat?: Tables<"menu_categories">; nextSort?: number }) {
  const id = cat?.id ?? "newcat";
  return (
    <ActionForm action={saveCategory} className="mt-3 grid gap-3 sm:grid-cols-[2fr_2fr_1fr]">
      {cat && <input type="hidden" name="id" value={cat.id} />}
      <div>
        <label htmlFor={`${id}-label`}>Name</label>
        <input id={`${id}-label`} name="label" defaultValue={cat?.label} required placeholder="z. B. Vorspeise" />
      </div>
      <div>
        <label htmlFor={`${id}-sec`}>Untertitel (spanisch, optional)</label>
        <input id={`${id}-sec`} name="label_secondary" defaultValue={cat?.label_secondary ?? ""} placeholder="Para compartir" />
      </div>
      <div>
        <label htmlFor={`${id}-sort`}>Reihenfolge</label>
        <input id={`${id}-sort`} name="sort_order" type="number" defaultValue={cat?.sort_order ?? nextSort ?? 0} />
      </div>
      <div className="sm:col-span-3">
        <label htmlFor={`${id}-note`}>Hinweis unter der Kategorie (optional)</label>
        <input id={`${id}-note`} name="note" defaultValue={cat?.note ?? ""} placeholder="Alle Gerichte werden mit Salat oder Pommes serviert." />
      </div>
      {/* undefined = migration 0008 not applied yet; the toggle is then hidden and not submitted. */}
      {(!cat || typeof cat.show_prices === "boolean") && (
        <div className="sm:col-span-3">
          <input type="hidden" name="show_prices_field" value="1" />
          <label className="!mb-0 flex items-center gap-2 text-sm normal-case tracking-normal">
            <input type="checkbox" name="show_prices" defaultChecked={cat?.show_prices ?? true} /> Preise auf der Website anzeigen
          </label>
          <p className="mt-1 text-xs text-muted">Ausgeschaltet: Die Gerichte bleiben sichtbar, nur die Preise dieser Kategorie nicht.</p>
        </div>
      )}
      <div className="sm:col-span-3">
        <SubmitButton>{cat ? "Kategorie speichern" : "Anlegen"}</SubmitButton>
      </div>
    </ActionForm>
  );
}

function ItemRow({ item, categories }: { item: Tables<"menu_items">; categories: Tables<"menu_categories">[] }) {
  return (
    <details className={`rounded-md border border-line bg-white ${item.is_available ? "" : "opacity-60"}`}>
      <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
        <span className="min-w-0 flex-1">
          <strong>{item.name}</strong>
          {item.subtitle && <span className="ml-2 text-xs uppercase tracking-wider text-blue-dark">{item.subtitle}</span>}
          {item.description && <span className="block truncate text-xs text-muted">{item.description}</span>}
        </span>
        {item.is_featured && <span className="status bg-sky-100 text-sky-800">Startseite</span>}
        {!item.is_available && <span className="status bg-gray-200 text-gray-600">Ausverkauft</span>}
        <span className="text-sm font-bold">{item.price_label}</span>
        <form action={toggleMenuItemAvailable}>
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="is_available" value={item.is_available ? "false" : "true"} />
          <button className="btn-ghost !py-1">{item.is_available ? "Ausverkauft" : "Wieder da"}</button>
        </form>
      </summary>
      <div className="border-t border-line px-3 pb-3">
        <ItemForm categories={categories} item={item} />
      </div>
    </details>
  );
}

function ItemForm({
  categories,
  item,
  defaultCategory,
  nextSort,
}: {
  categories: Tables<"menu_categories">[];
  item?: Tables<"menu_items">;
  defaultCategory?: string;
  nextSort?: number;
}) {
  const id = item?.id ?? `new-${defaultCategory}`;
  return (
    <div className="mt-3 grid gap-4">
      <ActionForm action={saveMenuItem} className="grid gap-3 sm:grid-cols-6">
        {item && <input type="hidden" name="id" value={item.id} />}
        <div className="sm:col-span-3">
          <label htmlFor={`${id}-name`}>Name (wie auf der Karte)</label>
          <input id={`${id}-name`} name="name" defaultValue={item?.name} required />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={`${id}-price`}>Preis</label>
          <input id={`${id}-price`} name="price_label" defaultValue={item?.price_label ?? ""} placeholder="4,50 € oder 3,50 / 4,50 €" />
        </div>
        <div>
          <label htmlFor={`${id}-sort`}>Reihenfolge</label>
          <input id={`${id}-sort`} name="sort_order" type="number" defaultValue={item?.sort_order ?? nextSort ?? 0} />
        </div>
        <div className="sm:col-span-4">
          <label htmlFor={`${id}-desc`}>Beschreibung / Übersetzung (deutsch, optional)</label>
          <input id={`${id}-desc`} name="description" defaultValue={item?.description ?? ""} placeholder="Gefüllte Teigtasche mit Rindfleisch, Zwiebeln und Paprika" />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={`${id}-subtitle`}>Zusatz (optional)</label>
          <input id={`${id}-subtitle`} name="subtitle" defaultValue={item?.subtitle ?? ""} placeholder="Recién hechas" />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={`${id}-cat`}>Kategorie</label>
          <select id={`${id}-cat`} name="category_id" defaultValue={item?.category_id ?? defaultCategory}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-5 text-sm sm:col-span-4">
          <label className="!mb-0 flex items-center gap-2 normal-case tracking-normal">
            <input type="checkbox" name="is_available" defaultChecked={item?.is_available ?? true} /> Verfügbar
          </label>
          <label className="!mb-0 flex items-center gap-2 normal-case tracking-normal">
            <input type="checkbox" name="is_featured" defaultChecked={item?.is_featured ?? false} /> Auf Startseite
          </label>
        </div>
        <div className="sm:col-span-6">
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
