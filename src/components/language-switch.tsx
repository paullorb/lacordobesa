"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { GlobeIcon } from "@/components/icons";
import { LOCALE_NAME, LOCALES, localeHref, stripLocale, type Locale } from "@/lib/i18n";

type Props = {
  locale: Locale;
  label: string;
  /** Locale-independent path of the page ("/karte"). Left out, it is read from the URL. */
  path?: string;
  /** "inline" is the row of codes (the open phone menu, the footer). "menu" is the quiet globe in
   *  the desktop bar, which opens its list only when pointed at, focused or tapped. */
  variant?: "inline" | "menu";
};

/** Offers the current page in the other two languages.
 *
 *  Each language is named in its own language, which is the convention that works for somebody who
 *  cannot read the one currently showing. The links point at the same `path` rather than at the home
 *  page, because sending a reader back to the start to change language is the thing that makes people
 *  give up. Plain links, so they work without JavaScript and are crawlable as hreflang targets.
 *
 *  Most visitors never change language, so the bar only carries a globe and the current code. */
export function LanguageSwitch(props: Props) {
  return props.path === undefined ? <SwitchFromUrl {...props} /> : <Switch {...props} target={props.path} />;
}

/** Reading the URL is what keeps a build from prerendering a route whose path is a parameter
 *  (`/abmelden/[token]`), so the hook lives here and a caller that knows its path never reaches it.
 *  Without a `path`, the caller has to wrap this in Suspense. */
function SwitchFromUrl(props: Props) {
  return <Switch {...props} target={stripLocale(usePathname())} />;
}

function Switch({ locale, label, variant = "inline", target }: Omit<Props, "path"> & { target: string }) {
  const labelId = useId();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const list = (
    <ul aria-labelledby={labelId}>
      {LOCALES.map((candidate) => (
        <li key={candidate}>
          {candidate === locale ? (
            <span aria-current="true">{variant === "menu" ? LOCALE_NAME[candidate] : candidate.toUpperCase()}</span>
          ) : (
            <Link href={localeHref(candidate, target)} hrefLang={candidate} lang={candidate} onClick={() => setOpen(false)}>
              {variant === "menu" ? (
                LOCALE_NAME[candidate]
              ) : (
                <>
                  <span aria-hidden="true">{candidate.toUpperCase()}</span>
                  <span className="sr-only">{LOCALE_NAME[candidate]}</span>
                </>
              )}
            </Link>
          )}
        </li>
      ))}
    </ul>
  );

  if (variant === "menu") {
    return (
      <div className="lang-menu" ref={root} data-open={open || undefined}>
        <span className="sr-only" id={labelId}>
          {label}
        </span>
        <button type="button" className="lang-menu-button" aria-expanded={open} aria-label={`${label}: ${LOCALE_NAME[locale]}`} onClick={() => setOpen((o) => !o)}>
          <GlobeIcon size={16} />
          <span aria-hidden="true">{locale.toUpperCase()}</span>
        </button>
        <div className="lang-menu-list">{list}</div>
      </div>
    );
  }

  return (
    <div className="lang-switch">
      <span className="sr-only" id={labelId}>
        {label}
      </span>
      {list}
    </div>
  );
}
