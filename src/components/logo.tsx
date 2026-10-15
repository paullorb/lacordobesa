import Image from "next/image";
import { LOGO } from "@/lib/brand";

/** The logo is an SVG, so it is served as-is (optimization adds nothing). */
export function Logo({ alt = "", className }: { alt?: string; className?: string }) {
  return <Image src={LOGO.full} alt={alt} width={240} height={240} unoptimized className={className} />;
}
