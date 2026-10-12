"use client";

import { Fragment, type ReactNode } from "react";

export type WizardStep = {
  /** The question this step asks, shown as the heading. */
  title: string;
  /** The answer, shown as a chip once the step is behind you. Leave unset while there is none:
   *  a step can be optional, and an empty chip is worse than no chip. */
  summary?: string | null;
  /** sr-only label on that chip, e.g. "Datum ändern", since the chip itself only shows the answer. */
  changeLabel?: string;
  /** The step's own markup, including its `wizard-body` wrapper. Owning the wrapper is what lets
   *  the last step be a `<form>` rather than a `<div>`. */
  body: ReactNode;
};

type Props = {
  /** 1-based, because every label the guest sees counts from one. */
  step: number;
  setStep: (step: number) => void;
  steps: WizardStep[];
  /** "Schritt 2 von 4", announced to screen readers. */
  stepLabel: (step: number, total: number) => string;
  /** Shown under the current step, for notes that belong to the form rather than to one question. */
  footer?: ReactNode;
};

/**
 * One question at a time, with the answers so far kept as chips you can go back to.
 *
 * Shared by the table booking and the celebration inquiry. Both ask a short series of questions and
 * only want contact details once the guest has decided something, so they were always the same shape;
 * the inquiry had simply been written as one long form. This component owns the chrome (progress,
 * chips, heading, the animation between steps) and nothing about what is being asked, so neither
 * form's own state machine has to move in here.
 */
export function Wizard({ step, setStep, steps, stepLabel, footer }: Props) {
  const total = steps.length;
  const current = steps[step - 1];
  if (!current) return null;

  return (
    <div className="form wizard">
      <p className="sr-only">{stepLabel(step, total)}</p>
      <div className="wizard-dots" aria-hidden="true">
        {steps.map((s, i) => (
          <span key={s.title} className={i + 1 <= step ? "on" : undefined} />
        ))}
      </div>

      {step > 1 && (
        <div className="wizard-summary">
          {steps.slice(0, step - 1).map((s, i) =>
            s.summary == null ? null : (
              <button key={s.title} type="button" className="chip" onClick={() => setStep(i + 1)}>
                {s.summary} <span aria-hidden="true">✎</span>
                <span className="sr-only">{s.changeLabel}</span>
              </button>
            ),
          )}
        </div>
      )}

      <h3 className="wizard-title">{current.title}</h3>

      {/* Keyed on the step so React remounts rather than reusing the node, which is what makes the
          wizard-step-in animation replay instead of firing once on first render. */}
      <Fragment key={step}>{current.body}</Fragment>

      {footer}
    </div>
  );
}
