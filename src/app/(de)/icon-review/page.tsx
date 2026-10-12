import { GLYPHS } from "@/components/menu-icons/glyphs";
import { MenuItemIcon, menuIconFor } from "@/components/menu-icons";

/** Review-only page for the menu icons. It carries its own copy of the card (identical to
 *  supabase/seed_menu.sql and to the live menu_items rows on 2026-10-12) so the icons can be
 *  looked at without a database, a login or an env file. Delete with the branch. */

const MENU: { slug: string; label: string; secondary?: string; items: [string, string | null, string][] }[] = [
  {
    slug: "vorspeise",
    label: "Vorspeise",
    secondary: "Para compartir",
    items: [
      ["Brot mit Alioli", "Hausgemachtes Brot mit Knoblauchmayonnaise", "4,50 €"],
      ["Brot mit Chimichurri", "Hausgemachtes Brot mit argentinischer Kräutersauce", "4,50 €"],
      ["Bruschetta", "Geröstetes Brot mit Tomaten, Knoblauch und Olivenöl", "6,00 €"],
      ["Provoleta", "Gegrillter Provolone-Käse mit Oregano", "5,00 €"],
      ["Tortilla de Patatas", "Spanisches Kartoffelomelett mit Ei", "5,00 €"],
      ["Serrano und Käse Platte", "Auswahl an Serrano-Schinken und Käse", "9,00 €"],
      [
        "Tabla „La Cordobesa“",
        "Tortilla de Patatas, Provoleta, Chorizo criollo, hausgemachtes Brot, Chimichurri und zwei Empanadas",
        "25,00 €",
      ],
      ["Pommes", "Pommes frites", "3,50 €"],
    ],
  },
  {
    slug: "empanadas",
    label: "Empanadas",
    secondary: "Argentinische Spezialität",
    items: [
      ["Empanada Criolla", "Gefüllte Teigtasche mit Rindfleisch, Zwiebeln und Paprika", "4,50 €"],
      ["Empanada de Pollo", "Gefüllte Teigtasche mit Geflügelfleisch", "4,50 €"],
      ["Empanada de Espinaca y Ricota", "Gefüllte Teigtasche mit Spinat und Ricotta", "4,50 €"],
      ["Empanada de Humita", "Gefüllte Teigtasche mit Mais und Käse", "4,50 €"],
      ["Empanada Caprese", "Gefüllte Teigtasche mit Tomate, Mozzarella und Basilikum", "4,50 €"],
      ["Empanada de Fugazzetta", "Gefüllte Teigtasche mit Zwiebeln und Käse", "4,50 €"],
      ["Las Tres Empanadas", "Drei Empanadas mit Beilagensalat", "12,00 €"],
    ],
  },
  {
    slug: "pasta",
    label: "Hausgemachte Pasta",
    items: [
      [
        "Sorrentinos de Espinaca y Ricota",
        "Hausgemachter Nudelteig gefüllt mit Ricotta, Zwiebeln und Sahne, serviert mit Bolognese- oder Pestosauce",
        "9,00 €",
      ],
      ["Lasagna", "Tomatensauce, Mozzarella und Schinken", "9,00 €"],
    ],
  },
  {
    slug: "clasico",
    label: "Clásico Argentino",
    items: [["Choripán", "Argentinische Bratwurst im Brot mit Chimichurri", "7,00 €"]],
  },
  {
    slug: "pizzas",
    label: "Pizzas",
    items: [
      ["Margherita", "Tomatensauce, Mozzarella und Basilikum", "8,00 €"],
      ["Prosciutto", "Tomatensauce, Mozzarella und Schinken", "9,50 €"],
      ["Prosciutto Funghi", "Tomatensauce, Mozzarella, Schinken und Champignons", "10,50 €"],
      ["Salami", "Tomatensauce, Mozzarella und Salami", "9,50 €"],
      ["4 Quesos", "Mozzarella, Gorgonzola, Emmentaler und Parmesan", "10,50 €"],
      ["Parma, Rúcula & Schinken", "Tomatensauce, Mozzarella, Parmaschinken und Rucola", "12,50 €"],
      ["Extra Burrata", null, "+ 1,50 €"],
    ],
  },
  {
    slug: "hauptgerichte",
    label: "Hauptgerichte",
    secondary: "Platos principales",
    items: [
      ["Bife de Chorizo (200 g)", "Argentinisches Rindersteak vom Grill", "21,00 €"],
      ["Ojo de Bife", "Saftiges Rib-Eye-Steak vom Grill", "25,00 €"],
      ["Milanesa", "Paniertes Rindsschnitzel", "13,00 €"],
      ["Milanesa Napolitana", "Paniertes Rindsschnitzel mit Tomatensauce, Schinken und Käse", "15,00 €"],
    ],
  },
  {
    slug: "desserts",
    label: "Desserts",
    secondary: "Postres",
    items: [
      ["Flan con Dulce de Leche", "Karamellpudding mit argentinischer Karamellcreme", "5,00 €"],
      ["Tiramisú", "Klassisches italienisches Dessert", "7,00 €"],
      ["Tarta del Día", "Hausgemachter Kuchen des Tages", "6,00 €"],
    ],
  },
  {
    slug: "alkoholfrei",
    label: "Alkoholfreie Getränke",
    items: [
      ["Coca-Cola / Coca-Cola Zero / Fanta / Sprite", null, "3,50 / 4,50 €"],
      ["Agua con Gas", "Mineralwasser mit Kohlensäure", "3,00 / 4,00 €"],
      ["Agua sin Gas", "Mineralwasser ohne Kohlensäure", "3,00 / 4,00 €"],
      ["Jugo / Zumo", "Saft", "2,50 €"],
    ],
  },
  {
    slug: "alkoholisch",
    label: "Alkoholische Getränke",
    items: [
      ["Pils", null, "3,00 / 4,50 €"],
      ["Pils alkoholfrei", null, "3,00 / 4,50 €"],
      ["Franziskaner Weissbier", null, "4,50 €"],
      ["Franziskaner Weissbier alkoholfrei", null, "4,50 €"],
      ["San Miguel", null, "4,00 €"],
      ["San Miguel alkoholfrei", null, "4,00 €"],
    ],
  },
  {
    slug: "heiss",
    label: "Heißgetränke",
    items: [
      ["Americano", null, "3,50 €"],
      ["Kaffee", null, "2,50 €"],
      ["Espresso", null, "2,75 €"],
      ["Espresso Macchiato", null, "2,75 €"],
      ["Doppelter Espresso", null, "3,50 €"],
      ["Cappuccino", null, "3,00 €"],
      ["Latte Macchiato", null, "4,00 €"],
      ["Dekoffinierter Kaffee", null, "2,50 €"],
      ["Dekoffinierter Cappuccino", null, "3,00 €"],
      ["Dekoffinierter Latte Macchiato", null, "4,00 €"],
      ["Tee", null, "2,50 €"],
      ["Eiskaffee", null, "4,50 €"],
      ["Heiße Schokolade", null, "3,00 €"],
    ],
  },
  {
    slug: "cocktails",
    label: "Cocktails",
    items: [
      ["Aperol Spritz", null, "7,00 €"],
      ["Fernet con Cola", null, "7,00 €"],
      ["Limoncello Spritz", null, "7,00 €"],
      ["Campari Orange", null, "7,00 €"],
      ["Negroni", null, "7,00 €"],
      ["Gin Tonic", null, "7,00 €"],
      ["Lillét", null, "7,00 €"],
      ["La Cordobesa", null, "7,00 €"],
      ["La Cordobesa alkoholfrei", null, "7,00 €"],
      ["Prosecco", null, "6,00 €"],
    ],
  },
];

export default function IconReviewPage() {
  const items = MENU.flatMap((c) => c.items.map(([name]) => ({ name, slug: c.slug })));

  return (
    <div className="site">
      <main id="main">
        <section className="menu-section">
          <div className="inner">
            <div className="section-heading">
              <p className="eyebrow">Review</p>
              <h1>Icons auf der Karte</h1>
              <p>
                {items.length} Positionen, {Object.keys(GLYPHS).length} Zeichnungen. Links die Karte wie sie aussähe,
                darunter jedes Zeichen einzeln.
              </p>
            </div>

            <div className="full-menu">
              {MENU.map((c) => (
                <div className="full-menu-cat" key={c.slug}>
                  <h2>
                    {c.label}
                    {c.secondary && <small>{c.secondary}</small>}
                  </h2>
                  <ul>
                    {c.items.map(([name, text, price]) => (
                      <li key={name}>
                        <MenuItemIcon itemName={name} categorySlug={c.slug} />
                        <span>
                          <strong>{name}</strong>
                          {text && <small>{text}</small>}
                        </span>
                        <span className="full-menu-price">{price}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="icon-sheet">
              <h2>Jedes Zeichen einzeln</h2>
              <ul>
                {items.map(({ name, slug }) => (
                  <li key={name}>
                    <MenuItemIcon itemName={name} categorySlug={slug} size={34} />
                    <strong>{name}</strong>
                    <code>{menuIconFor(name)?.glyph ?? `(${slug})`}</code>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
