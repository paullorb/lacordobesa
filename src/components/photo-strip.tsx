import Image from "next/image";
import Link from "next/link";
import { InstagramIcon } from "@/components/instagram-icon";
import { CONTACT } from "@/lib/contact";
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
export function PhotoStrip({ featured, posts }: { featured: Tables<"gallery_items">[]; posts: InstagramPost[] }) {
  const photos: Photo[] =
    posts.length > 0
      ? posts.map((post) => ({
          key: post.id,
          src: post.image,
          alt: post.caption ? firstLine(post.caption) : `Instagram-Beitrag von ${CONTACT.instagramHandle}`,
          href: post.url,
          external: true,
        }))
      : featured.map((item) => ({
          key: item.id,
          src: item.image_url,
          alt: item.caption ?? "Foto aus dem Lokal von La Cordobesa",
          href: "/gallery",
          external: false,
        }));

  if (photos.length === 0) return null;

  return (
    <section className="section photo-strip-section" aria-labelledby="photos-title">
      <div className="inner">
        <div className="section-heading">
          <p className="eyebrow">Así se ve</p>
          <h2 id="photos-title">Bei uns im Lokal</h2>
          <p>
            {posts.length > 0 ? (
              <>
                Die neuesten Bilder von{" "}
                <a href={CONTACT.instagram} target="_blank" rel="noreferrer">
                  {CONTACT.instagramHandle}
                </a>
                .
              </>
            ) : (
              <>
                Ein paar Lieblingsbilder. Mehr davon in der <Link href="/gallery">Galerie</Link>.
              </>
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
              </a>
            </li>
          ))}
        </ul>

        <p className="menu-more">
          <a className="inline-icon text-link" href={CONTACT.instagram} target="_blank" rel="noreferrer">
            <InstagramIcon size={14} /> Seguinos auf Instagram
          </a>
        </p>
      </div>
    </section>
  );
}

/** Instagram captions run long and carry hashtags; alt text wants one readable sentence. */
function firstLine(caption: string) {
  const line = caption.split("\n")[0].replace(/#\w+/g, "").trim();
  return line.length > 120 ? `${line.slice(0, 117)}…` : line || `Instagram-Beitrag von ${CONTACT.instagramHandle}`;
}
