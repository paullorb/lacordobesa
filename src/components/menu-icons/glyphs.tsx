import type { ReactNode } from "react";

/** Every glyph is drawn on the same 24x24 grid and takes its colour from the text beside it, so one
 *  icon works on cream, on paper and in the staff UI without a second copy. Strokes only, no fills
 *  except for crumbs and bubbles: at the 20px the menu renders them at, a filled shape turns to mud.
 *
 *  Items are matched to a glyph in ./index.tsx. Several dishes share one glyph on purpose; six
 *  near-identical empanadas read better as their fillings than as six half-moons. */
export const GLYPHS = {
  // --- Vorspeise ---------------------------------------------------------------------------------
  bread_dip: (
    <>
      <path d="M3.5 19.5v-6.1a3.5 3.5 0 0 1 7 0v6.1z" />
      <path d="M12.4 15h9.2a4.6 4.6 0 0 1-9.2 0z" />
      <path d="M17 9.4c1.4 1.7 2.1 2.8 2.1 3.4a2.1 2.1 0 0 1-4.2 0c0-.6.7-1.7 2.1-3.4z" />
    </>
  ),
  bread_herb: (
    <>
      <path d="M3.5 19.5v-6.1a3.5 3.5 0 0 1 7 0v6.1z" />
      <path d="M17 20.5V10" />
      <path d="M17 14.2c0-2 1.4-3.3 3.4-3.5-.2 2-1.4 3.3-3.4 3.5z" />
      <path d="M17 17.6c0-2-1.4-3.3-3.4-3.5.2 2 1.4 3.3 3.4 3.5z" />
    </>
  ),
  bruschetta: (
    <>
      <path d="M3.5 14.5h17v3a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2z" />
      <rect x="5.8" y="10.8" width="3.4" height="3.4" rx=".8" />
      <rect x="10.3" y="10.8" width="3.4" height="3.4" rx=".8" />
      <rect x="14.8" y="10.8" width="3.4" height="3.4" rx=".8" />
      <path d="M12 10.8c.6-1.8 2.4-2.6 4.2-2.3-.3 1.8-1.8 2.9-3.4 2.9" />
    </>
  ),
  provoleta: (
    <>
      <circle cx="12" cy="10.2" r="5.6" />
      <path d="M8.2 14.6c-.5 1.2-.8 2.1-.8 2.6" />
      <path d="M3 18.4h18M5 21h14" />
    </>
  ),
  tortilla: (
    <>
      <path d="M3.4 11.6c0-2.7 3.8-4.4 8.6-4.4s8.6 1.7 8.6 4.4v3.2c0 2.7-3.8 4.4-8.6 4.4s-8.6-1.7-8.6-4.4z" />
      <path d="M3.4 11.6c0 2.7 3.8 4.4 8.6 4.4s8.6-1.7 8.6-4.4" />
      <path d="M12 7.2v4.4M12 11.6l7.4 2.1" />
      <circle cx="8.6" cy="10.4" r=".8" fill="currentColor" stroke="none" />
      <circle cx="9.8" cy="13.4" r=".8" fill="currentColor" stroke="none" />
    </>
  ),
  platter: (
    <>
      <path d="M2.5 14.5h19a9.5 4.8 0 0 1-19 0z" />
      <circle cx="8.2" cy="12.2" r="2.6" />
      <circle cx="8.2" cy="12.2" r=".9" />
      <path d="M12.6 14.2 16.2 9.2l3.6 5z" />
    </>
  ),
  board: (
    <>
      <rect x="4.4" y="3" width="15.2" height="18" rx="2.2" />
      <circle cx="9.2" cy="8.4" r="2.4" />
      <path d="M13 11 16 6.4l3 4.6z" />
      <path d="M7.2 18.2a3.8 3.8 0 0 1 7.6 0z" />
    </>
  ),
  fries: (
    <>
      <path d="M6.6 11h10.8l-1.2 8.3a1.6 1.6 0 0 1-1.6 1.4H9.4a1.6 1.6 0 0 1-1.6-1.4z" />
      <path d="M9.2 11V5.6M12 11V3.6M14.8 11V6.4" />
    </>
  ),

  // --- Empanadas (the variants read as their filling; the heading already says empanada) ---------
  empanada: (
    <>
      <path d="M3.8 17.2a8.2 8.2 0 0 1 16.4 0z" />
      <path d="M6.6 15.1c1.8-3.2 9-3.2 10.8 0" />
      <path d="M5.4 17.2v2.8M8.6 17.2v2.8M12 17.2v2.8M15.4 17.2v2.8M18.6 17.2v2.8" />
    </>
  ),
  empanada_three: (
    <>
      <path d="M1.8 11.2a4.6 4.6 0 0 1 9.2 0z" />
      <path d="M13 11.2a4.6 4.6 0 0 1 9.2 0z" />
      <path d="M7.4 20a4.6 4.6 0 0 1 9.2 0z" />
    </>
  ),
  chicken_leg: (
    <>
      <path d="M19.8 4.2a4.3 4.3 0 0 0-6.1.3L10.2 8.4l5.4 5.4 3.9-3.5a4.3 4.3 0 0 0 .3-6.1z" />
      <path d="M14.4 12.6 9.6 17.4" />
      <circle cx="7.4" cy="19.6" r="2.1" />
      <circle cx="5.4" cy="17.4" r="2.1" />
    </>
  ),
  leaf: (
    <>
      <path d="M4 20C4 11 10.8 4 20 4c0 9.2-6.8 16-16 16z" />
      <path d="M4 20 20 4" />
    </>
  ),
  corn: (
    <>
      <path d="M12 3.4c3.1 0 5.2 3.2 5.2 7.9s-2.1 7.9-5.2 7.9-5.2-3.2-5.2-7.9S8.9 3.4 12 3.4z" />
      <path d="M9 8.2h6M8.3 11.6h7.4M9 15h6" />
      <path d="M12 19.2v1.4" />
      <path d="M7.2 11.6c-2.6-.8-4.2-2.8-4.2-2.8 2.6-.7 4.6.4 5.2 1.8" />
    </>
  ),
  tomato_basil: (
    <>
      <circle cx="10.8" cy="14.2" r="6" />
      <path d="M10.8 8.2V6.4" />
      <path d="M11.2 7.6c1.6-2.6 4.8-2.8 6.8-1.8-.8 2.6-3.6 3.8-5.8 2.8" />
    </>
  ),
  onion: (
    <>
      <path d="M12 20.4c-4.1 0-6.7-2.4-6.7-5.6 0-4.6 3.6-7.2 6.7-10.8 3.1 3.6 6.7 6.2 6.7 10.8 0 3.2-2.6 5.6-6.7 5.6z" />
      <path d="M12 20.4c-1.6 0-2.5-2.3-2.5-5.6 0-2.7 1-5 2.5-7.2 1.5 2.2 2.5 4.5 2.5 7.2 0 3.3-.9 5.6-2.5 5.6z" />
      <path d="M12 4 10 1.8M12 4l2-2.2" />
    </>
  ),

  // --- Pasta -------------------------------------------------------------------------------------
  ravioli: (
    <>
      <path d="M20 12a2.6 2.6 0 0 1-1.53 4.7 2.6 2.6 0 0 1-4 2.91 2.6 2.6 0 0 1-4.94 0 2.6 2.6 0 0 1-4-2.91A2.6 2.6 0 0 1 4 12a2.6 2.6 0 0 1 1.53-4.7 2.6 2.6 0 0 1 4-2.91 2.6 2.6 0 0 1 4.94 0 2.6 2.6 0 0 1 4 2.91A2.6 2.6 0 0 1 20 12z" />
      <circle cx="12" cy="12" r="4.4" />
    </>
  ),
  lasagna: (
    <>
      <path d="M4 10.2h16v7.3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <path d="M4 10.2c1.3-1.8 2.7-1.8 4 0 1.3-1.8 2.7-1.8 4 0 1.3-1.8 2.7-1.8 4 0 1.3-1.8 2.7-1.8 4 0" />
      <path d="M4.4 13.6h15.2M4.4 16.6h15.2" />
    </>
  ),

  // --- Clasico -----------------------------------------------------------------------------------
  choripan: (
    <>
      <rect x="2.4" y="8.6" width="19.2" height="4.4" rx="2.2" />
      <path d="M4.6 13h14.8a3.6 3.6 0 0 1-3.6 3.6H8.2A3.6 3.6 0 0 1 4.6 13z" />
      <path d="M7 10.4c.7-.9 1.6-.9 2.3 0M12.6 10.4c.7-.9 1.6-.9 2.3 0" />
    </>
  ),

  // --- Pizzas (also read as their topping) -------------------------------------------------------
  pizza: (
    <>
      <path d="M12 2.6 20.2 18.6a9.6 9.6 0 0 1-16.4 0z" />
      <path d="M5.2 16.6a9.4 9.4 0 0 0 13.6 0" />
      <circle cx="12" cy="10.4" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="9.4" cy="14" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="14.6" cy="14" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  ham: (
    <>
      <path d="M4.6 19.4c-2-2-1.4-5.8 1.4-8.6 2.8-2.8 6.6-3.4 8.6-1.4 2 2 1.4 5.8-1.4 8.6-2.8 2.8-6.6 3.4-8.6 1.4z" />
      <path d="M14.6 9.4 18 6" />
      <circle cx="19.4" cy="4.6" r="1.6" />
    </>
  ),
  mushroom: (
    <>
      <path d="M3.6 11.4a8.4 8.4 0 0 1 16.8 0 1.3 1.3 0 0 1-1.3 1.3H4.9a1.3 1.3 0 0 1-1.3-1.3z" />
      <path d="M9.7 12.7v5.1a2.3 2.3 0 0 0 4.6 0v-5.1" />
    </>
  ),
  salami: (
    <>
      <circle cx="9.2" cy="9.4" r="5.6" />
      <circle cx="14.8" cy="15" r="5.6" />
      <circle cx="8.4" cy="8.4" r=".8" fill="currentColor" stroke="none" />
      <circle cx="10.8" cy="10.6" r=".8" fill="currentColor" stroke="none" />
      <circle cx="15.6" cy="16.2" r=".8" fill="currentColor" stroke="none" />
      <circle cx="13.4" cy="14" r=".8" fill="currentColor" stroke="none" />
    </>
  ),
  cheese: (
    <>
      <path d="M2.8 17.6 12.4 8a1.4 1.4 0 0 1 1-.4h5.2A1.4 1.4 0 0 1 20 9v8.6a1.4 1.4 0 0 1-1.4 1.4H4.2a1.4 1.4 0 0 1-1.4-1.4z" />
      <circle cx="15.6" cy="12.4" r="1.3" />
      <circle cx="10.8" cy="15.8" r="1.1" />
      <circle cx="17" cy="16.4" r="1" />
    </>
  ),
  rocket: (
    <>
      <path d="M12 21V8.6" />
      <path d="M12 13.2c-2.7 0-4.7-1.9-4.7-4.6 2.7 0 4.7 1.9 4.7 4.6z" />
      <path d="M12 13.2c2.7 0 4.7-1.9 4.7-4.6-2.7 0-4.7 1.9-4.7 4.6z" />
      <path d="M12 17.8c-2.3 0-3.9-1.6-3.9-3.9 2.3 0 3.9 1.6 3.9 3.9z" />
    </>
  ),
  burrata: (
    <>
      <circle cx="12" cy="14.6" r="6" />
      <path d="M9.6 9.2c.8-1.8 4-1.8 4.8 0" />
      <path d="M10.4 8.8 9.4 5.8M12 8.4V5.2M13.6 8.8l1-3" />
    </>
  ),

  // --- Hauptgerichte -----------------------------------------------------------------------------
  steak: (
    <>
      <path d="M3.8 13.4c0-4.2 4.2-6.8 8.6-6.8 4.4 0 7.8 2.2 7.8 5.4 0 3.2-3 5.8-7.8 5.8-4.8 0-8.6-1.6-8.6-4.4z" />
      <path d="M7.4 11 11 14.6M10.4 9.4 14 13M13.6 8.6 17 12" />
    </>
  ),
  steak_ribeye: (
    <>
      <path d="M12 4.4c5.1 0 8.8 3.1 8.8 7.2S17.1 19.6 12 19.6 3.2 15.7 3.2 11.6 6.9 4.4 12 4.4z" />
      <path d="M9.2 10.4c1.9-1.6 4.6-1.1 5.6.9 1 2-.4 4.2-2.5 4.2s-4.3-3.4-3.1-5.1z" />
    </>
  ),
  cutlet: (
    <>
      <path d="M3.6 12.4C3.6 7.9 7.4 4.6 12 4.6s8.4 3.3 8.4 7.8-3.8 7.2-8.4 7.2-8.4-2.7-8.4-7.2z" />
      <circle cx="9" cy="10" r=".8" fill="currentColor" stroke="none" />
      <circle cx="13.4" cy="8.8" r=".8" fill="currentColor" stroke="none" />
      <circle cx="15.8" cy="12.6" r=".8" fill="currentColor" stroke="none" />
      <circle cx="11" cy="14.4" r=".8" fill="currentColor" stroke="none" />
      <circle cx="7.4" cy="14" r=".8" fill="currentColor" stroke="none" />
    </>
  ),
  cutlet_napoli: (
    <>
      <path d="M3.6 12.4C3.6 7.9 7.4 4.6 12 4.6s8.4 3.3 8.4 7.8-3.8 7.2-8.4 7.2-8.4-2.7-8.4-7.2z" />
      <path d="M4.8 10.2c1.2-2.6 3.6-4.2 6.5-4.2 2.4 0 4.5 1.1 5.7 2.8-.7 2.5-3.1 4.1-6.3 4.1-2.6 0-4.7-1.1-5.9-2.7z" />
      <circle cx="14.4" cy="14.8" r="2.2" />
    </>
  ),

  // --- Desserts ----------------------------------------------------------------------------------
  flan: (
    <>
      <path d="M8.2 16.4 9.8 8.6h4.4l1.6 7.8z" />
      <path d="M8.6 11.2h6.8" />
      <path d="M3.6 16.4h16.8" />
      <path d="M6 16.4c0 1.7 2.7 2.8 6 2.8s6-1.1 6-2.8" />
    </>
  ),
  tiramisu: (
    <>
      <path d="M4 11h16v6.6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <path d="M4.4 14.2h15.2M4.4 17h15.2" />
      <path d="M14.6 6.6c1.9 0 3.4 1 3.4 2.2s-1.5 2.2-3.4 2.2-3.4-1-3.4-2.2 1.5-2.2 3.4-2.2z" />
      <path d="M14.6 6.6v4.4" />
    </>
  ),
  cake_slice: (
    <>
      <path d="M3.4 18.6 11.3 6.5a.8.8 0 0 1 1.4 0l7.9 12.1a.9.9 0 0 1-.8 1.4H4.2a.9.9 0 0 1-.8-1.4z" />
      <path d="M6.6 14h10.8" />
      <circle cx="12" cy="9.2" r="1.3" />
    </>
  ),

  // --- Alkoholfreie Getranke ---------------------------------------------------------------------
  soda: (
    <>
      <path d="M6.4 7h11.2l-1.3 12.3a1.6 1.6 0 0 1-1.6 1.4H9.3a1.6 1.6 0 0 1-1.6-1.4z" />
      <path d="M13.8 7 17 2.6" />
      <circle cx="10.6" cy="11.4" r=".85" fill="currentColor" stroke="none" />
      <circle cx="13.6" cy="13.8" r=".85" fill="currentColor" stroke="none" />
      <circle cx="11" cy="16.2" r=".85" fill="currentColor" stroke="none" />
    </>
  ),
  water_sparkling: (
    <>
      <path d="M9.8 2.8h4.4v3.1l2.3 3.3a3 3 0 0 1 .5 1.7v8.3a1.6 1.6 0 0 1-1.6 1.6H8.6A1.6 1.6 0 0 1 7 19.2v-8.3a3 3 0 0 1 .5-1.7l2.3-3.3z" />
      <circle cx="10.4" cy="12.6" r=".85" fill="currentColor" stroke="none" />
      <circle cx="13.4" cy="14.8" r=".85" fill="currentColor" stroke="none" />
      <circle cx="10.8" cy="17.2" r=".85" fill="currentColor" stroke="none" />
    </>
  ),
  water_still: (
    <>
      <path d="M9.8 2.8h4.4v3.1l2.3 3.3a3 3 0 0 1 .5 1.7v8.3a1.6 1.6 0 0 1-1.6 1.6H8.6A1.6 1.6 0 0 1 7 19.2v-8.3a3 3 0 0 1 .5-1.7l2.3-3.3z" />
      <path d="M7.2 12.6c1.4-1.2 2.4-1.2 3.6 0s2.4 1.2 3.6 0 2.4-1.2 2.4-.3" />
    </>
  ),
  juice: (
    <>
      <path d="M6.4 8h11.2l-1.3 11.3a1.6 1.6 0 0 1-1.6 1.4H9.3a1.6 1.6 0 0 1-1.6-1.4z" />
      <path d="M7.2 11.8h9.6" />
      <path d="M14.4 8a3.6 3.6 0 0 1 7.2 0z" />
      <path d="M18 8V4.6M15.6 5.6l4.8 0" />
    </>
  ),

  // --- Alkoholische Getranke ---------------------------------------------------------------------
  beer_pils: (
    <>
      <path d="M7.4 6.4h9.2l-1 13.1a1.6 1.6 0 0 1-1.6 1.5h-4A1.6 1.6 0 0 1 8.4 19.5z" />
      <path d="M7.4 6.4c.4-1.9 2.3-2.3 3.1-1 .8-1.8 3.2-1.8 3.9.2.5-1.3 2.3-1 2.2 1" />
      <path d="M7.8 10.6h8.4" />
    </>
  ),
  beer_wheat: (
    <>
      <path d="M5.6 5h8.8l-.9 5.6c-.2 1.5.4 2.2.8 3.4.7 2-.5 5.8-4.3 5.8s-5-3.8-4.3-5.8c.4-1.2 1-1.9.8-3.4z" />
      <path d="M5.6 5c.3-1.7 2.1-2 2.8-.9.7-1.6 2.9-1.6 3.5.2.5-1.1 1.9-.9 1.8.7" />
      <path d="M5.9 8.6h8.2" />
      <path d="M19.4 20.6V10" />
      <path d="M19.4 13.4c-1.5 0-2.6-1-2.6-2.5 1.5 0 2.6 1 2.6 2.5z" />
      <path d="M19.4 13.4c1.5 0 2.6-1 2.6-2.5-1.5 0-2.6 1-2.6 2.5z" />
      <path d="M19.4 17c-1.4 0-2.4-1-2.4-2.3 1.4 0 2.4 1 2.4 2.3z" />
      <path d="M19.4 17c1.4 0 2.4-1 2.4-2.3-1.4 0-2.4 1-2.4 2.3z" />
    </>
  ),
  beer_bottle: (
    <>
      <path d="M9.8 2.6h4.4v2.9l1.9 2.7a3 3 0 0 1 .5 1.7v9.5a1.6 1.6 0 0 1-1.6 1.6H8.9a1.6 1.6 0 0 1-1.6-1.6V9.9a3 3 0 0 1 .5-1.7l1.9-2.7z" />
      <path d="M7.4 12.4h9.2M7.4 16.4h9.2" />
    </>
  ),

  // --- Heissgetranke -----------------------------------------------------------------------------
  coffee_cup: (
    <>
      <path d="M4.6 8.6h11.2v4.8a5.6 5.6 0 0 1-11.2 0z" />
      <path d="M15.8 10.2h2.2a2.3 2.3 0 0 1 0 4.6h-2.2" />
      <path d="M3 20.4h14.4" />
      <path d="M8.6 6c0-1 1-1.4 1-2.5M12.6 6c0-1 1-1.4 1-2.5" />
    </>
  ),
  americano: (
    <>
      <path d="M5.6 6.4h10.2v7.2a5.1 5.1 0 0 1-10.2 0z" />
      <path d="M15.8 8h2a2.1 2.1 0 0 1 0 4.2h-2" />
      <path d="M5.8 9.6h9.8" />
      <path d="M4 20.4h13.4" />
    </>
  ),
  espresso: (
    <>
      <path d="M7 10h9.2v3.8a4.6 4.6 0 0 1-9.2 0z" />
      <path d="M16.2 11.2h1.7a2 2 0 0 1 0 4h-1.7" />
      <path d="M5.4 19.6h12.4" />
    </>
  ),
  espresso_double: (
    <>
      <path d="M2.4 10.6h7.2v3.2a3.6 3.6 0 0 1-7.2 0z" />
      <path d="M9.6 11.6h1.3a1.6 1.6 0 0 1 0 3.2H9.6" />
      <path d="M1.4 19.4h9.6" />
      <path d="M13.4 10.6h7.2v3.2a3.6 3.6 0 0 1-7.2 0z" />
      <path d="M20.6 11.6h1.3a1.6 1.6 0 0 1 0 3.2h-1.3" />
      <path d="M12.6 19.4h9.6" />
    </>
  ),
  espresso_macchiato: (
    <>
      <path d="M7 11.4h9.2v3.4a4.6 4.6 0 0 1-9.2 0z" />
      <path d="M16.2 12.4h1.7a2 2 0 0 1 0 4h-1.7" />
      <path d="M5.4 20.4h12.4" />
      <path d="M11.6 6.2c1.2 1.5 1.8 2.4 1.8 3a1.8 1.8 0 0 1-3.6 0c0-.6.6-1.5 1.8-3z" />
    </>
  ),
  cappuccino: (
    <>
      <path d="M4.6 10h11.2v4.2a5.6 5.6 0 0 1-11.2 0z" />
      <path d="M15.8 11.4h2.2a2.3 2.3 0 0 1 0 4.6h-2.2" />
      <path d="M3 20.6h14.4" />
      <path d="M4.6 10c.5-2.3 2.8-2.7 3.7-1.2 1-2.1 3.9-2.1 4.7.2.6-1.5 2.8-1.2 2.8 1" />
    </>
  ),
  latte_glass: (
    <>
      <path d="M7.4 4.4h9.2v13.7a2.5 2.5 0 0 1-2.5 2.5H9.9a2.5 2.5 0 0 1-2.5-2.5z" />
      <path d="M7.5 9.4h9M7.5 13.6h9" />
    </>
  ),
  tea: (
    <>
      <path d="M4.6 9.4h11.2v4.4a5.6 5.6 0 0 1-11.2 0z" />
      <path d="M15.8 10.8h2.2a2.3 2.3 0 0 1 0 4.6h-2.2" />
      <path d="M3 20.6h14.4" />
      <path d="M10.6 9.4V5.6h3.4" />
      <rect x="13.4" y="3.2" width="3.6" height="3.6" rx=".7" />
    </>
  ),
  iced_coffee: (
    <>
      <path d="M6.8 5.6h10.4l-1.2 13.6a1.8 1.8 0 0 1-1.8 1.6H9.8a1.8 1.8 0 0 1-1.8-1.6z" />
      <path d="M13.8 5.6 17.2 2" />
      <rect x="8.8" y="9" width="3.6" height="3.6" rx=".7" />
      <rect x="12.4" y="13.2" width="3.2" height="3.2" rx=".7" />
    </>
  ),
  hot_chocolate: (
    <>
      <path d="M4.2 10.4h11v7a3 3 0 0 1-3 3H7.2a3 3 0 0 1-3-3z" />
      <path d="M15.2 12h2.3a2.4 2.4 0 0 1 0 4.8h-2.3" />
      <path d="M7.4 8c-1.1-1.1 1.1-2.1 0-3.2M10.8 8c-1.1-1.1 1.1-2.1 0-3.2" />
      <rect x="15.6" y="2.8" width="6" height="3.6" rx=".6" />
      <path d="M17.6 2.8v3.6M19.6 2.8v3.6" />
    </>
  ),

  // --- Cocktails ---------------------------------------------------------------------------------
  wine_orange: (
    <>
      <path d="M6.8 4.4h10.4c0 4.1-2.1 6.7-4.2 7.3v6.4h3.1v2H7.9v-2H11v-6.4C8.9 11.1 6.8 8.5 6.8 4.4z" />
      <path d="M2.4 4.4a3.4 3.4 0 0 1 6.8 0z" />
      <path d="M5.8 4.4V1M3.4 2.2h4.8" />
    </>
  ),
  wine_lemon: (
    <>
      <path d="M6.8 4.4h10.4c0 4.1-2.1 6.7-4.2 7.3v6.4h3.1v2H7.9v-2H11v-6.4C8.9 11.1 6.8 8.5 6.8 4.4z" />
      <path d="M2.2 5.6 5.8 1.4l3.6 4.2z" />
      <path d="M5.8 1.4v4.2" />
    </>
  ),
  wine_berry: (
    <>
      <path d="M6.8 4.4h10.4c0 4.1-2.1 6.7-4.2 7.3v6.4h3.1v2H7.9v-2H11v-6.4C8.9 11.1 6.8 8.5 6.8 4.4z" />
      <circle cx="5.2" cy="4.4" r="2.6" />
      <path d="M5.2 1.8c-.8-1.2-2-1.4-2.8-1 .2 1.4 1.4 2.2 2.6 2" />
    </>
  ),
  highball: (
    <>
      <path d="M7 4.4h10v14.9a1.8 1.8 0 0 1-1.8 1.8H8.8A1.8 1.8 0 0 1 7 19.3z" />
      <path d="M7.1 8.4h9.8" />
      <circle cx="10.2" cy="11.6" r=".85" fill="currentColor" stroke="none" />
      <circle cx="13.4" cy="14" r=".85" fill="currentColor" stroke="none" />
      <circle cx="10.6" cy="16.4" r=".85" fill="currentColor" stroke="none" />
    </>
  ),
  highball_orange: (
    <>
      <path d="M7 6.4h10v12.9a1.8 1.8 0 0 1-1.8 1.8H8.8A1.8 1.8 0 0 1 7 19.3z" />
      <path d="M7.1 10h9.8" />
      <path d="M14.4 6.4a3.5 3.5 0 0 1 7 0z" />
      <path d="M17.9 6.4V2.9M15.4 4.1h5" />
      <path d="M13.4 6.4 16.2 1.8" />
    </>
  ),
  rocks_ice: (
    <>
      <path d="M5.4 7.6h13.2l-1 11.5a1.8 1.8 0 0 1-1.8 1.6H8.2a1.8 1.8 0 0 1-1.8-1.6z" />
      <path d="M5.8 11.4h12.4" />
      <rect x="9" y="13" width="5.2" height="5.2" rx=".8" transform="rotate(-14 11.6 15.6)" />
    </>
  ),
  copa_lime: (
    <>
      <path d="M5.6 5.6h12.8c0 4.6-2.6 7.4-5.2 8v4.6h3.2v2.2H7.6v-2.2h3.2v-4.6c-2.6-.6-5.2-3.4-5.2-8z" />
      <path d="M2 6.8 5.4 2.4l3.4 4.4z" />
      <circle cx="16.6" cy="3.4" r="1" fill="currentColor" stroke="none" />
      <circle cx="19.4" cy="5" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  coupe_star: (
    <>
      <path d="M4.4 5.4h15.2L12 13.6z" />
      <path d="M12 13.6v5.2M8.4 20.4h7.2" />
      <path d="M18.4 15.4l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
    </>
  ),
  flute: (
    <>
      <path d="M9 3h6l-.6 9.5a2.4 2.4 0 0 1-4.8 0z" />
      <path d="M12 14.9v5.1M9.2 20.6h5.6" />
      <circle cx="11.2" cy="6.4" r=".8" fill="currentColor" stroke="none" />
      <circle cx="13.2" cy="8.8" r=".8" fill="currentColor" stroke="none" />
      <circle cx="11.4" cy="10.8" r=".8" fill="currentColor" stroke="none" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type GlyphName = keyof typeof GLYPHS;
