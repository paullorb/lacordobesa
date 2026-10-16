"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTrackForm } from "@/components/analytics";
import { subscribeToSpecials } from "@/app/specials/actions";
import { PhoneNote } from "@/components/phone-note";
import { CHANNEL_LABEL, OPEN_CHANNELS, type BroadcastChannel } from "@/lib/broadcast";
import { whatsappHref } from "@/lib/contact";
import { getDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/i18n";
import { FIELD_LIMITS } from "@/lib/reservation-limits";
import { ideaDescription, ideaTitle, isIdeaUntranslated, type SpecialIdea } from "@/lib/special-ideas";

/** The step before the form: what we may offer, then the question. Only a yes unfolds the fields.
 *  A "no" folds the question away for this page view and nothing is stored: no cookie, no storage.  */
type Stage = "ask" | "form" | "declined";

/** Opt-in for the weekly special. One contact detail, one explicit consent checkbox, nothing else:
 *  every extra field here costs sign-ups, and none of them would be used.
 *
 *  `ideas` are the "what we may offer" cards staff keep under /staff/specials. With none, the box is
 *  just the question and the form, as before. */
export function SpecialsOptin({ locale, ideas = [] }: { locale: Locale; ideas?: SpecialIdea[] }) {
  const [state, formAction, pending] = useActionState(subscribeToSpecials, null);
  useTrackForm("specials", state, pending);
  const [channel, setChannel] = useState<BroadcastChannel>(OPEN_CHANNELS[0]);
  const t = getDictionary(locale).optin;
  const [stage, setStage] = useState<Stage>("ask");
  const nameRef = useRef<HTMLInputElement>(null);
  const reopenRef = useRef<HTMLButtonElement>(null);
  const moveFocusTo = useRef<"name" | "reopen" | null>(null);

  // The steps fold with `inert` while closed, so the control to focus only becomes focusable after the
  // render that opens it. Focus therefore moves in an effect, and only after a click, never on load.
  useEffect(() => {
    const target = moveFocusTo.current;
    moveFocusTo.current = null;
    if (target === "name") nameRef.current?.focus({ preventScroll: true });
    if (target === "reopen") reopenRef.current?.focus({ preventScroll: true });
  }, [stage]);

  const go = (next: Stage, focus: "name" | "reopen") => {
    moveFocusTo.current = focus;
    setStage(next);
  };

  // Double opt-in: the sign-up is stored unconfirmed, and the guest's own message from the number
  // they entered is the proof that they, and not someone else, asked for it.
  if (state?.ok) {
    return (
      <div className="optin optin-done" role="status">
        <strong>{t.doneTitle}</strong>
        <p>{t.doneText}</p>
        <a className="button" href={whatsappHref(t.confirmMessage)} target="_blank" rel="noreferrer">
          {t.confirmCta}
        </a>
      </div>
    );
  }

  return (
    <>
      {ideas.length > 0 && (
        <section className="special-ideas" aria-labelledby="special-ideas-title">
          <p className="eyebrow">{t.ideasEyebrow}</p>
          <h3 id="special-ideas-title">{t.ideasTitle}</h3>
          <ul className="special-ideas-grid">
            {ideas.map((idea) => (
              <li key={idea.id} lang={isIdeaUntranslated(idea, locale) ? "de" : undefined}>
                <span className="tag">{t.ideaTag}</span>
                <strong>{ideaTitle(idea, locale)}</strong>
                {ideaDescription(idea, locale) && <p>{ideaDescription(idea, locale)}</p>}
              </li>
            ))}
          </ul>
          <p className="special-ideas-note">{t.ideasNote}</p>
        </section>
      )}

      <form action={formAction} className={ideas.length > 0 ? "optin optin-after-ideas" : "optin"}>
        <div className="optin-copy">
          <p className="eyebrow">{t.eyebrow}</p>
          <h2>{t.title}</h2>
          <p>{t.text}</p>
        </div>

        <div className="optin-steps">
          {/* Step 1: the question. Folds away on either answer. */}
          <div className="optin-step" data-open={stage === "ask"} inert={stage !== "ask"}>
            <div className="optin-step-inner optin-ask">
              <button type="button" className="button" onClick={() => go("form", "name")}>
                {t.yes}
              </button>
              <button type="button" className="button button-quiet" onClick={() => go("declined", "reopen")}>
                {t.no}
              </button>
            </div>
          </div>

          {/* Declined: one quiet line, and the way back. Nothing is remembered beyond this page view. */}
          <div className="optin-step" data-open={stage === "declined"} inert={stage !== "declined"}>
            <div className="optin-step-inner optin-declined">
              <span>{t.declined}</span>
              <button type="button" className="optin-reopen" ref={reopenRef} onClick={() => go("form", "name")}>
                {t.reopen}
              </button>
            </div>
          </div>

          {/* Step 2: only after a yes. */}
          <div className="optin-step" data-open={stage === "form"} inert={stage !== "form"}>
            <div className="optin-step-inner optin-fields">
              {OPEN_CHANNELS.length > 1 && (
                <div className="slots" role="group" aria-label={t.channelLabel}>
                  {OPEN_CHANNELS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className="slot"
                      aria-pressed={channel === c}
                      onClick={() => setChannel(c)}
                    >
                      {CHANNEL_LABEL[c]}
                    </button>
                  ))}
                </div>
              )}
              <input type="hidden" name="channel" value={channel} />
              <input type="hidden" name="locale" value={locale} />

              <div>
                <label htmlFor="optin-name">{t.name}</label>
                <input id="optin-name" ref={nameRef} name="name" maxLength={FIELD_LIMITS.name} autoComplete="name" />
              </div>

              {channel === "whatsapp" ? (
                <div>
                  <label htmlFor="optin-phone">{t.phone}</label>
                  <input
                    id="optin-phone"
                    name="phone"
                    type="tel"
                    maxLength={FIELD_LIMITS.phone}
                    autoComplete="tel"
                    required
                    placeholder="+49 …"
                  />
                </div>
              ) : (
                <div>
                  <label htmlFor="optin-email">{t.emailLabel}</label>
                  <input id="optin-email" name="email" type="email" maxLength={FIELD_LIMITS.email} autoComplete="email" required />
                </div>
              )}

              <label className="optin-consent">
                <input type="checkbox" name="consent" required />
                <span>{t.consent[channel]}</span>
              </label>

              {state && !state.ok && (
                <p className="form-error" role="alert">
                  {state.error}
                </p>
              )}

              <button type="submit" className="button" disabled={pending}>
                {pending ? t.submitting : t.submit}
              </button>
              <PhoneNote locale={locale} />
            </div>
          </div>
        </div>
      </form>
    </>
  );
}
