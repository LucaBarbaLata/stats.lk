"use client";

import { Check } from "lucide-react";
import { useActionState, useState, type ReactNode } from "react";
import type { FormState } from "@/app/(app)/settings/actions";
import { SettingsHeader } from "@/components/settings-ui";
import { buttonClass } from "@/components/ui";

// A settings form whose result ("Saved", or what's wrong) shows next to its
// button. `action` is a server action taking (previous state, form data).
// With a `title` it is the page's main form: the title and the Save button
// sit in a header at the top, and Save stays off until something changes.
export function SettingsForm({
  action,
  title,
  description,
  submitLabel,
  pendingLabel = "Saving…",
  variant = "primary",
  children,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  title?: string;
  description?: ReactNode;
  submitLabel?: string;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "danger";
  children?: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [dirty, setDirty] = useState(false);
  // A successful save leaves nothing unsaved
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state?.ok) setDirty(false);
  }

  const status = state && !pending && (
    <p role="status" className={`flex items-center gap-1.5 text-sm ${state.ok ? "text-accent" : "text-red-300"}`}>
      {state.ok && <Check className="size-4" />}
      {state.message}
    </p>
  );

  if (title) {
    return (
      <form action={formAction} onInput={() => setDirty(true)} onChange={() => setDirty(true)} className="space-y-8">
        <SettingsHeader
          title={title}
          description={description}
          action={
            <>
              {status}
              <button disabled={pending || !dirty} className={`${buttonClass("primary")} h-11 min-w-24 px-6 disabled:opacity-40`}>
                {pending ? pendingLabel : (submitLabel ?? "Save")}
              </button>
            </>
          }
        />
        {children}
      </form>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className={`${buttonClass(variant)} disabled:opacity-60`}>
          {pending ? pendingLabel : (submitLabel ?? "Save changes")}
        </button>
        {status}
      </div>
    </form>
  );
}
