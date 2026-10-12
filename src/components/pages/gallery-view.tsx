import { GalleryGrid } from "@/components/gallery-grid";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { whatsappHref } from "@/lib/contact";
import { getDictionary } from "@/lib/dictionaries";
import { getAnnouncement, getGalleryItems } from "@/lib/data";
import type { Locale } from "@/lib/i18n";

export const GALLERY_PATH = "/gallery";

export async function GalleryView({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).galleryPage;
  const [announcement, items] = await Promise.all([getAnnouncement(), getGalleryItems()]);

  return (
    // `lang` on the wrapper, because the single root layout cannot know the locale. See the note in
    // src/lib/i18n.ts: assistive technology and :lang() honour the nearest ancestor, and Google is
    // told through the hreflang alternates in each page's metadata.
    <div className="site">
      {announcement && <div className="announcement">{announcement}</div>}
      <SiteHeader whatsappHref={whatsappHref()} locale={locale} path={GALLERY_PATH} />

      <main id="main">
        <section className="menu-section gallery-section">
          <div className="inner">
            <div className="section-heading">
              <p className="eyebrow">{t.eyebrow}</p>
              <h1>{t.title}</h1>
              <p>{t.intro}</p>
            </div>
            {items.length > 0 ? (
              <GalleryGrid
                locale={locale}
                photos={items.map((i) => ({ id: i.id, url: i.image_url, caption: i.caption, category: i.category }))}
              />
            ) : (
              <p className="form-note">{t.empty}</p>
            )}
          </div>
        </section>
      </main>

      <SiteFooter locale={locale} />
    </div>
  );
}
