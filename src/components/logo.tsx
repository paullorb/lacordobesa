import Image from "next/image";

/** The logo is an SVG, so it is served as-is (optimization adds nothing). */
export function Logo({ alt = "", className }: { alt?: string; className?: string }) {
  return <Image src="/assets/logo.svg" alt={alt} width={240} height={240} unoptimized className={className} />;
}
