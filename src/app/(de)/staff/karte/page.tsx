import { Suspense } from "react";
import { StaffLoading } from "@/components/staff/card-bits";
import { deleteCategory, deleteMenuItem, saveCategory, saveMenuItem, toggleMenuItemAvailable } from "@/app/staff/actions";
import { ActionForm, ConfirmSubmit, SubmitButton } from "@/components/staff/form-bits";
import { MenuArranger } from "@/components/staff/menu-arranger";
import { TranslationField } from "@/components/staff/translation-field";
import { requireStaff } from "@/lib/auth";
import type { Tables } from "@/lib/database.types";

export const metadata = { title: "Karte" };

export default function MenuPage() {
  return (
    <Suspense fallback={<StaffLoading />}>
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
  // Migration 0008 may not be deployed yet. With categories loaded the column shows up (or not) on the rows;
  // without any, a probe select tells the two states apart (PostgREST errors with 42703 on a missing column).
  const showPricesColumn =
    cats.length > 0
      ? typeof cats[0].show_prices === "boolean"
      : !(await supabase.from("menu_categories").select("show_prices").limit(1)).error;
  // Same trick for the translation columns from migration 20261012102608.
  const translationColumns =
    all.length > 0 ? "description_es" in all[0] : !(await supabase.from("menu_items").select("description_es").limit(1)).error;
  // And for the pre-order columns from migration 20261012094815.
  const preorderColumns =
    all.length > 0
      ? typeof all[0].is_preorderable === "boolean"
      : !(await supabase.from("menu_items").select("is_preorderable").limit(1)).error;

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-serif text-3xl">Karte</h1>
        <p className="text-sm text-muted">Am Griff ⠿ ziehen, um Gerichte und Kategorien zu verschieben.</p>
      </div>

      {!showPricesColumn && (
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

      <MenuArranger
        // The header, footer and row elements below carry keys although none sits in a list here:
        // MenuArranger renders each inside a static children array, and when its streamed chunk is
        // still pending at that first render React only meets the element during array reconciliation,
        // where an unkeyed, unvalidated element is the "unique key prop" warning (#147). A key is what
        // that check exempts, and it is why the warning came and went with timing.
        // A new server order remounts it, so after every save it shows what the database holds.
        key={[...cats.map((c) => c.id), ...all.map((i) => `${i.id}:${i.category_id}:${i.sort_order}:${i.is_featured}`)].join()}
        categories={cats.map((cat) => {
          const catItems = all.filter((i) => i.category_id === cat.id);
          return {
            id: cat.id,
            slug: cat.slug,
            label: cat.label,
            header: (
              <details key={cat.id} className="group">
                <summary className="flex cursor-pointer flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line pb-2">
                  <h2 className="font-serif text-xl">{cat.label}</h2>
                  {cat.label_secondary && <span className="text-xs uppercase tracking-wider text-blue-dark">{cat.label_secondary}</span>}
                  {cat.note && <span className="text-xs italic text-muted">{cat.note}</span>}
                  {cat.show_prices === false && <span className="status bg-amber-100 text-amber-800">Preise ausgeblendet</span>}
                  <span className="ml-auto text-xs text-muted group-open:hidden">Kategorie bearbeiten ▾</span>
                </summary>
                <div className="card mt-2 grid gap-4">
                  <CategoryForm cat={cat} showPricesColumn={showPricesColumn} />
                  {catItems.length === 0 && (
                    <form action={deleteCategory} className="justify-self-start">
                      <input type="hidden" name="id" value={cat.id} />
                      <ConfirmSubmit message={`Kategorie „${cat.label}“ löschen?`}>Kategorie löschen</ConfirmSubmit>
                    </form>
                  )}
                </div>
              </details>
            ),
            footer: (
              <details key={cat.id} className="rounded-md border border-dashed border-line px-3 py-2">
                <summary className="cursor-pointer text-sm font-semibold text-blue-dark">+ Gericht in „{cat.label}“</summary>
                <ItemForm
                  categoryId={cat.id}
                  nextSort={(catItems.at(-1)?.sort_order ?? 0) + 1}
                  preorderColumns={preorderColumns}
                  translationColumns={translationColumns}
                />
              </details>
            ),
          };
        })}
        items={all.map((item) => ({
          id: item.id,
          categoryId: item.category_id,
          name: item.name,
          featured: item.is_featured,
          available: item.is_available,
          row: <ItemRow key={item.id} item={item} preorderColumns={preorderColumns} translationColumns={translationColumns} />,
        }))}
      />

      <details className="card">
        <summary className="cursor-pointer text-sm font-semibold">+ Neue Kategorie</summary>
        <CategoryForm nextSort={(cats.at(-1)?.sort_order ?? 0) + 1} showPricesColumn={showPricesColumn} />
      </details>
    </div>
  );
}

function CategoryForm({
  cat,
  nextSort,
  showPricesColumn,
}: {
  cat?: Tables<"menu_categories">;
  nextSort?: number;
  showPricesColumn: boolean;
}) {
  const id = cat?.id ?? "newcat";
  return (
    <ActionForm action={saveCategory} className="mt-3 grid gap-3 sm:grid-cols-2">
      {cat && <input type="hidden" name="id" value={cat.id} />}
      <div>
        <label htmlFor={`${id}-label`}>Name</label>
        <input id={`${id}-label`} name="label" defaultValue={cat?.label} required placeholder="z. B. Vorspeise" />
      </div>
      <div>
        <label htmlFor={`${id}-sec`}>Untertitel (spanisch)</label>
        <input id={`${id}-sec`} name="label_secondary" defaultValue={cat?.label_secondary ?? ""} placeholder="Para compartir" />
      </div>
      {!cat && <input type="hidden" name="sort_order" value={nextSort ?? 0} />}
      <div className="sm:col-span-2">
        <label htmlFor={`${id}-note`}>Hinweis unter der Kategorie</label>
        <input id={`${id}-note`} name="note" defaultValue={cat?.note ?? ""} placeholder="Alle Gerichte werden mit Salat oder Pommes serviert." />
      </div>
      {/* Before migration 0008 the toggle is hidden and not submitted, so saveCategory leaves the column out. */}
      {showPricesColumn && (
        <div className="sm:col-span-2">
          <input type="hidden" name="show_prices_field" value="1" />
          <label className="!mb-0 flex items-center gap-2 text-sm normal-case tracking-normal">
            <input type="checkbox" name="show_prices" defaultChecked={cat?.show_prices ?? true} /> Preise auf der Website anzeigen
          </label>
          <p className="mt-1 text-xs text-muted">Ausgeschaltet: Die Gerichte bleiben sichtbar, nur die Preise dieser Kategorie nicht.</p>
        </div>
      )}
      <div className="sm:col-span-2">
        <SubmitButton>{cat ? "Kategorie speichern" : "Anlegen"}</SubmitButton>
      </div>
    </ActionForm>
  );
}

function ItemRow({
  item,
  preorderColumns,
  translationColumns,
}: {
  item: Tables<"menu_items">;
  preorderColumns: boolean;
  translationColumns: boolean;
}) {
  return (
    <details className={`rounded-md border border-line bg-white ${item.is_available ? "" : "opacity-60"}`}>
      <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 py-2 pl-10 pr-3">
        <span className="min-w-0 flex-1">
          <strong>{item.name}</strong>
          {item.subtitle && <span className="ml-2 text-xs uppercase tracking-wider text-blue-dark">{item.subtitle}</span>}
          {/* line-clamp rather than truncate: `truncate` is white-space:nowrap, whose min-content is
            the whole sentence, and a grid track never shrinks below min-content. That one class
            made the page 667px wide inside a 390px phone, which is what tipped Safari into
            shrink-to-fit and left the header ending two thirds across the screen. */}
        {item.description && <span className="line-clamp-1 text-xs text-muted">{item.description}</span>}
        </span>
        {item.is_preorderable && <span className="status bg-cream text-ink">vorbestellbar</span>}
        {item.is_featured && <span className="status bg-sky-100 text-sky-800">Startseite</span>}
        {!item.is_available && <span className="status bg-gray-200 text-gray-600">Ausverkauft</span>}
        <span className="text-sm font-bold">{item.price_label}</span>
      </summary>
      <div className="border-t border-line px-3 pb-3">
        {/* The one control for availability: saved on its own, not with the form below, so a sold-out
            dish is one tap away once its card is open and nowhere on the list before that. */}
        <form action={toggleMenuItemAvailable} className="mt-3">
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="is_available" value={item.is_available ? "false" : "true"} />
          <button className="btn-ghost">{item.is_available ? "Ausverkauft melden" : "Wieder anbieten"}</button>
        </form>
        <ItemForm
          item={item}
          preorderColumns={preorderColumns}
          translationColumns={translationColumns}
        />
      </div>
    </details>
  );
}

function ItemForm({
  item,
  categoryId,
  nextSort,
  preorderColumns,
  translationColumns,
}: {
  item?: Tables<"menu_items">;
  /** Only for a new dish: where it goes. An existing one is moved by dragging. */
  categoryId?: string;
  nextSort?: number;
  preorderColumns: boolean;
  translationColumns: boolean;
}) {
  const id = item?.id ?? `new-${categoryId}`;
  return (
    <div className="mt-3 grid gap-4">
      <ActionForm action={saveMenuItem} className="grid gap-3 sm:grid-cols-6">
        {item ? (
          <input type="hidden" name="id" value={item.id} />
        ) : (
          <>
            <input type="hidden" name="category_id" value={categoryId} />
            <input type="hidden" name="sort_order" value={nextSort ?? 0} />
          </>
        )}
        <div className="sm:col-span-4">
          <label htmlFor={`${id}-name`}>Name (wie auf der Karte)</label>
          <input id={`${id}-name`} name="name" defaultValue={item?.name} required />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={`${id}-price`}>Preis</label>
          <input id={`${id}-price`} name="price_label" defaultValue={item?.price_label ?? ""} placeholder="4,50 € oder 3,50 / 4,50 €" />
        </div>
        <div className="sm:col-span-4">
          <label htmlFor={`${id}-desc`}>Beschreibung (deutsch)</label>
          <input id={`${id}-desc`} name="description" defaultValue={item?.description ?? ""} placeholder="Gefüllte Teigtasche mit Rindfleisch, Zwiebeln und Paprika" />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={`${id}-subtitle`}>Zusatz</label>
          <input id={`${id}-subtitle`} name="subtitle" defaultValue={item?.subtitle ?? ""} placeholder="Vegetarisch" />
        </div>
        {/* Before migration 20261012102608 these are hidden and not submitted. Empty is fine and
            normal: the Spanish and English menu pages fall back to the German description and say so. */}
        {translationColumns && (
          <TranslationField id={id} es={item?.description_es ?? ""} en={item?.description_en ?? ""} className="sm:col-span-6" />
        )}
        {/* Before migration 20261012094815 these are hidden and not submitted, so saveMenuItem leaves
            the columns out entirely. */}
        {preorderColumns && (
          <div className="sm:col-span-6">
            <input type="hidden" name="preorder_field" value="1" />
            <label className="!mb-0 flex items-center gap-2 text-sm normal-case tracking-normal">
              <input type="checkbox" name="is_preorderable" defaultChecked={item?.is_preorderable ?? false} /> Zum
              Vorbestellen anbieten
            </label>
          </div>
        )}
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
