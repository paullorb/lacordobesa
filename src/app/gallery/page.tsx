import type { Metadata } from "next";
import { GalleryGrid } from "@/components/gallery-grid";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { CONTACT, whatsappHref } from "@/lib/contact";
import { getAnnouncement, getGalleryItems } from "@/lib/data";

export const metadata: Metadata = {
  title: "Galerie",
  description: "Einblicke in La Cordobesa: unser Lokal, hausgemachte Empanadas und Süßes, Feiern und besondere Momente.",
};

export default async function GalleryPage() {
  const [announcement, items] = await Promise.all([getAnnouncement(), getGalleryItems()]);

  return (
    <div className="site">
      {announcement && <div className="announcement">{announcement}</div>}
      <SiteHeader whatsappHref={whatsappHref()} phoneHref={`tel:${CONTACT.phoneE164}`} />

      <main>
        <section className="menu-section gallery-section">
          <div className="inner">
            <div className="section-heading">
              <p className="eyebrow">Momentos</p>
              <h1>Galerie</h1>
              <p>Unser Lokal, frisch Gebackenes und Feiern bei uns: ein kleiner Einblick.</p>
            </div>
            {items.length > 0 ? (
              <GalleryGrid
                photos={items.map((i) => ({ id: i.id, url: i.image_url, caption: i.caption, category: i.category }))}
              />
            ) : (
              <p className="form-note">Hier erscheinen bald die ersten Bilder.</p>
            )}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
