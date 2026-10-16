import Image from "next/image";
import { InstagramIcon } from "@/components/instagram-icon";
import { CONTACT } from "@/lib/contact";
import { getDictionary } from "@/lib/dictionaries";
import { localeHref, type Locale } from "@/lib/i18n";
import type { InstagramPost } from "@/lib/instagram";
import type { Tables } from "@/lib/database.types";

type Photo = { key: string; src: string; alt: string; href: string; external: boolean };

/** The photo strip on the landing page.
 *
 *  Prefers Instagram when a token is configured, because that keeps moving without anybody touching
 *  it, and falls back to the photos staff featured in the gallery. If there is neither, the whole
 *  section is absent rather than showing an empty frame.
 *
 *  Captions are the alt text when there is one. A caption written for humans beats a generated
 *  "Foto 3", and an empty alt would be wrong here: these images are content, not decoration. */
export function PhotoStrip({
  locale,
  featured,
  posts,
}: {
  locale: Locale;
  featured: Tables<"gallery_items">[];
  posts: InstagramPost[];
}) {
  const t = getDictionary(locale).photos;
  const photos: Photo[] =
    posts.length > 0
      ? posts.map((post) => ({
          key: post.id,
          src: post.image,
          alt: (post.caption && firstLine(post.caption)) || t.instagramAlt(CONTACT.instagramHandle),
          href: post.url,
          external: true,
        }))
      : featured.map((item) => ({
          key: item.id,
          src: item.image_url,
          alt: item.caption ?? getDictionary(locale).home.galleryPhotoAlt,
          href: localeHref(locale, "/gallery"),
          external: false,
        }));

  if (photos.length === 0) return null;

  return (
    <section className="section photo-strip-section" id="fotos" aria-labelledby="photos-title">
      <div className="inner">
        <div className="section-heading">
          <p className="eyebrow">{t.eyebrow}</p>
          <h2 id="photos-title">{t.title}</h2>
          <p>
            {posts.length > 0 ? (
              <a href={CONTACT.instagram} target="_blank" rel="noreferrer">
                {t.fromInstagram(CONTACT.instagramHandle)}
              </a>
            ) : (
              t.fromGallery
            )}
          </p>
        </div>

        <ul className="photo-strip">
          {photos.map((photo) => (
            <li key={photo.key}>
              <a
                href={photo.href}
                {...(photo.external ? { target: "_blank", rel: "noreferrer" } : {})}
                aria-label={photo.alt}
              >
                <Image src={photo.src} alt={photo.alt} width={400} height={400} sizes="(max-width: 800px) 45vw, 22vw" />
                {/* The caption, shown on hover where there is a pointer. The link already carries
                    the same words as its name, so this one is hidden from the reading order. */}
                <span className="photo-strip-caption" aria-hidden="true">
                  {photo.alt}
                </span>
              </a>
            </li>
          ))}
        </ul>

        <p className="menu-more">
          <a className="inline-icon text-link" href={CONTACT.instagram} target="_blank" rel="noreferrer">
            <InstagramIcon size={14} /> {t.follow}
          </a>
        </p>
      </div>
    </section>
  );
}

/** Instagram captions run long and carry hashtags; alt text wants one readable sentence. */
function firstLine(caption: string) {
  const line = caption.split("\n")[0].replace(/#\w+/g, "").trim();
  return line.length > 120 ? `${line.slice(0, 117)}…` : line;
}
