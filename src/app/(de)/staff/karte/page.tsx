import { Suspense } from "react";
import { StaffLoading } from "@/components/staff/card-bits";
import { deleteCategory, deleteMenuItem, saveCategory, saveMenuItem, toggleMenuItemAvailable } from "@/app/staff/actions";
import { ActionForm, ConfirmSubmit, SubmitButton } from "@/components/staff/form-bits";
import { requireStaff } from "@/lib/auth";
import type { Tables } from "@/lib/database.types";
import { ADDITIVE_CODES, ADDITIVES, ALLERGEN_CODES, ALLERGENS, codeList } from "@/lib/allergens";

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
  // Same trick for the allergen columns from migration 20261012093136.
  const allergenColumns =
    all.length > 0 ? Array.isArray(all[0].allergens) : !(await supabase.from("menu_items").select("allergens").limit(1)).error;
  const missingCodes = allergenColumns ? all.filter((i) => (i.allergens ?? []).length === 0).length : 0;
  // And for the translation columns from migration 20261012102608.
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
        <p className="text-sm text-muted">
          Klick auf ein Gericht, um Name, Beschreibung (deutsche Übersetzung) und Preis zu ändern. „Startseite“
          markiert die drei Highlights oben auf der Website; „Ausverkauft“ blendet ein Gericht aus, ohne es zu löschen.
          Die spanischen und englischen Beschreibungen sind optional: ohne sie zeigen die Seiten /es und /en die
          deutsche Beschreibung und weisen darauf hin.
        </p>
      </div>

      {allergenColumns && missingCodes > 0 && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {missingCodes} {missingCodes === 1 ? "Gericht hat" : "Gerichte haben"} noch keine Allergen-Kennzeichnung. In
          Deutschland müssen die 14 Allergene auf der Karte stehen, also am besten bald nachtragen.
        </p>
      )}
      {!allergenColumns && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Die Allergen-Kennzeichnung ist erst verfügbar, sobald die Datenbank-Migration 20261012093136 eingespielt ist.
        </p>
      )}
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
                <CategoryForm cat={cat} showPricesColumn={showPricesColumn} />
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
                <ItemRow
                  key={item.id}
                  item={item}
                  categories={cats}
                  allergenColumns={allergenColumns}
                  preorderColumns={preorderColumns}
                  translationColumns={translationColumns}
                />
              ))}
            </div>
            <details className="rounded-md border border-dashed border-line px-3 py-2">
              <summary className="cursor-pointer text-sm font-semibold text-blue-dark">+ Gericht in „{cat.label}“</summary>
              <ItemForm
                categories={cats}
                defaultCategory={cat.id}
                nextSort={(catItems.at(-1)?.sort_order ?? 0) + 1}
                allergenColumns={allergenColumns}
                preorderColumns={preorderColumns}
                translationColumns={translationColumns}
              />
            </details>
          </section>
        );
      })}

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
      {/* Before migration 0008 the toggle is hidden and not submitted, so saveCategory leaves the column out. */}
      {showPricesColumn && (
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

function ItemRow({
  item,
  categories,
  allergenColumns,
  preorderColumns,
  translationColumns,
}: {
  item: Tables<"menu_items">;
  categories: Tables<"menu_categories">[];
  allergenColumns: boolean;
  preorderColumns: boolean;
  translationColumns: boolean;
}) {
  const codes = [...(item.allergens ?? []), ...(item.additives ?? [])];
  return (
    <details className={`rounded-md border border-line bg-white ${item.is_available ? "" : "opacity-60"}`}>
      <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
        <span className="min-w-0 flex-1">
          <strong>{item.name}</strong>
          {item.subtitle && <span className="ml-2 text-xs uppercase tracking-wider text-blue-dark">{item.subtitle}</span>}
          {item.description && <span className="block truncate text-xs text-muted">{item.description}</span>}
        </span>
        {codes.length > 0 && <span className="status bg-mint text-blue-dark">{codeList(codes)}</span>}
        {item.is_preorderable && <span className="status bg-cream text-ink">vorbestellbar</span>}
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
        <ItemForm
          categories={categories}
          item={item}
          allergenColumns={allergenColumns}
          preorderColumns={preorderColumns}
          translationColumns={translationColumns}
        />
      </div>
    </details>
  );
}

function ItemForm({
  categories,
  item,
  defaultCategory,
  nextSort,
  allergenColumns,
  preorderColumns,
  translationColumns,
}: {
  categories: Tables<"menu_categories">[];
  item?: Tables<"menu_items">;
  defaultCategory?: string;
  nextSort?: number;
  allergenColumns: boolean;
  preorderColumns: boolean;
  translationColumns: boolean;
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
        {/* Before migration 20261012102608 these are hidden and not submitted. Empty is fine and
            normal: the Spanish menu page falls back to the German description and say so. */}
        {translationColumns && (
          <div className="grid gap-3 sm:col-span-6 sm:grid-cols-2">
            <input type="hidden" name="translations_field" value="1" />
            <div>
              <label htmlFor={`${id}-des`}>Beschreibung spanisch (optional)</label>
              <input
                id={`${id}-des`}
                name="description_es"
                maxLength={500}
                defaultValue={item?.description_es ?? ""}
                placeholder="Empanada rellena de carne, cebolla y morrón"
              />
            </div>
            <div>
              <label htmlFor={`${id}-den`}>Beschreibung englisch (optional)</label>
              <input
                id={`${id}-den`}
                name="description_en"
                maxLength={500}
                defaultValue={item?.description_en ?? ""}
                placeholder="Pastry parcel filled with beef, onion and pepper"
              />
            </div>
          </div>
        )}
        {/* Before migration 20261012094815 these are hidden and not submitted, so saveMenuItem leaves
            the columns out entirely. */}
        {preorderColumns && (
          <div className="grid gap-3 sm:col-span-6 sm:grid-cols-[auto_1fr]">
            <input type="hidden" name="preorder_field" value="1" />
            <label className="!mb-0 flex items-center gap-2 text-sm normal-case tracking-normal">
              <input type="checkbox" name="is_preorderable" defaultChecked={item?.is_preorderable ?? false} /> Zum
              Vorbestellen anbieten
            </label>
            <div>
              <label htmlFor={`${id}-unit`}>Einheit beim Vorbestellen</label>
              <input
                id={`${id}-unit`}
                name="preorder_unit"
                maxLength={24}
                defaultValue={item?.preorder_unit ?? "Stück"}
                placeholder="Stück, Dutzend, Torte, Blech …"
              />
            </div>
          </div>
        )}
        {/* Before migration 20261012093136 the grids are hidden and not submitted, so saveMenuItem
            leaves the columns out entirely. */}
        {allergenColumns && (
          <div className="grid gap-3 sm:col-span-6">
            <input type="hidden" name="codes_field" value="1" />
            <CodeGrid
              id={`${id}-alg`}
              name="allergens"
              legend="Allergene (Pflicht)"
              hint="Welche der 14 Allergene stecken in diesem Gericht?"
              codes={ALLERGEN_CODES}
              labels={ALLERGENS}
              selected={item?.allergens ?? []}
            />
            <CodeGrid
              id={`${id}-add`}
              name="additives"
              legend="Zusatzstoffe (nur wenn zutreffend)"
              hint="Bei hausgemachten Gerichten bleibt das meist leer."
              codes={ADDITIVE_CODES}
              labels={ADDITIVES}
              selected={item?.additives ?? []}
            />
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

/** Checkbox grid for one set of declaration codes. */
function CodeGrid({
  id,
  name,
  legend,
  hint,
  codes,
  labels,
  selected,
}: {
  id: string;
  name: string;
  legend: string;
  hint: string;
  codes: readonly string[];
  labels: Record<string, string>;
  selected: readonly string[];
}) {
  return (
    <fieldset className="rounded-md border border-line px-3 py-2">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-muted">{legend}</legend>
      <p className="mb-1.5 text-xs text-muted">{hint}</p>
      <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
        {codes.map((code) => (
          <label key={code} className="!mb-0 flex items-center gap-2 text-xs normal-case tracking-normal">
            <input type="checkbox" id={`${id}-${code}`} name={name} value={code} defaultChecked={selected.includes(code)} />
            <span>
              <strong>{code}</strong> {labels[code]}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
