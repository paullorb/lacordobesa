"use client";

import { useRef } from "react";
import { signOut } from "@/app/staff/actions";
import { StaffIcon } from "@/components/icons";
import { SubmitButton } from "@/components/staff/form-bits";

/**
 * Signing out, as an icon in the header that asks first.
 *
 * A labelled "Abmelden" button on every screen invited the tap, and on a phone the header is the
 * first thing a thumb reaches. The icon is quiet, and the dialog makes a stray tap harmless.
 */
export function SignOutButton({ name }: { name: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        className="flex min-h-10 items-center gap-2 rounded-full px-2.5 text-xs text-muted hover:bg-mint hover:text-ink"
        aria-label={`Abmelden (${name})`}
        title="Abmelden"
        onClick={() => dialog.current?.showModal()}
      >
        <span className="hidden sm:inline">{name}</span>
        <StaffIcon name="logout" size={20} />
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="signout-title"
        className="m-auto w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-line bg-white p-5 text-ink shadow-xl backdrop:bg-ink/40"
        // A click on the backdrop lands on the dialog element itself, not on anything inside it.
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
      >
        <form action={signOut} className="grid gap-4">
          <div>
            <h2 id="signout-title" className="font-serif text-xl">
              Abmelden?
            </h2>
            <p className="mt-1 text-sm text-muted">{name}, du musst dich danach neu anmelden.</p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="btn-ghost" autoFocus onClick={() => dialog.current?.close()}>
              Abbrechen
            </button>
            <SubmitButton pendingText="Abmelden …">Abmelden</SubmitButton>
          </div>
        </form>
      </dialog>
    </>
  );
}
