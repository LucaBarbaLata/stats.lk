"use client";

import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { checkUsername, type UsernameCheck } from "@/app/(app)/settings/actions";
import { USERNAME_MAX } from "@/lib/profile";

const fieldClass =
  "w-full rounded-xl bg-surface px-4 text-foreground ring-1 ring-border/70 transition ring-inset placeholder:text-subtle hover:ring-border-strong focus:ring-accent/60 focus:outline-none";

function Counter({ length, max }: { length: number; max: number }) {
  return (
    <span className={`text-xs tabular-nums ${length >= max ? "text-amber-300" : "text-subtle"}`} aria-hidden>
      {length}/{max}
    </span>
  );
}

// A labelled text field (or textarea) with a live "8/30" counter
export function CountedField({
  label,
  name,
  defaultValue,
  max,
  multiline,
  placeholder,
  hint,
}: {
  label: string;
  name: string;
  defaultValue: string;
  max: number;
  multiline?: boolean;
  placeholder?: string;
  hint?: string;
}) {
  const id = useId();
  const [length, setLength] = useState(defaultValue.length);
  const props = {
    id,
    name,
    defaultValue,
    maxLength: max,
    placeholder,
    onInput: (event: { currentTarget: { value: string } }) => setLength(event.currentTarget.value.length),
  };
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      {multiline ? (
        <textarea {...props} rows={4} className={`${fieldClass} resize-none py-3`} />
      ) : (
        <input {...props} autoComplete="off" className={`${fieldClass} h-12`} />
      )}
      <div className="flex justify-between gap-3">
        <span className="text-xs text-subtle">{hint}</span>
        <Counter length={length} max={max} />
      </div>
    </div>
  );
}

const CHECK_LABELS: Record<UsernameCheck, string> = {
  current: "Your link",
  available: "Available",
  taken: "Taken",
  invalid: "Not allowed",
};

// The profile link, checked as you type: is it free, and is it allowed?
export function UsernameField({ host, defaultValue }: { host: string; defaultValue: string }) {
  const id = useId();
  const [value, setValue] = useState(defaultValue);
  const [result, setResult] = useState<{ for: string; check: UsernameCheck } | null>({ for: defaultValue, check: "current" });

  useEffect(() => {
    if (!value) return;
    const timer = setTimeout(() => {
      checkUsername(value)
        .then((check) => setResult({ for: value, check }))
        .catch(() => {});
    }, 350);
    return () => clearTimeout(timer);
  }, [value]);

  // A result for an older value means a check is still on its way
  const check = value && result?.for === value ? result.check : null;
  const good = check === "available" || check === "current";

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium">
        Profile link
      </label>
      <div className={`flex h-12 items-center gap-2 pr-3 ${fieldClass} focus-within:ring-accent/60`}>
        <span className="shrink-0 text-subtle select-none">{host}/u/</span>
        <input
          id={id}
          name="username"
          value={value}
          onChange={(event) => setValue(event.target.value.toLowerCase().replace(/\s/g, ""))}
          maxLength={USERNAME_MAX}
          autoComplete="off"
          spellCheck={false}
          aria-describedby={`${id}-status`}
          className="h-full min-w-0 flex-1 bg-transparent font-medium outline-none focus-visible:outline-none"
        />
        <span
          id={`${id}-status`}
          aria-live="polite"
          className={`flex shrink-0 items-center gap-1.5 text-sm font-medium ${check === null ? "text-subtle" : good ? "text-accent" : "text-red-300"}`}
        >
          {check === null ? (
            value && <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <>
              {good ? <CircleCheck className="size-4" /> : <CircleAlert className="size-4" />}
              <span className="hidden sm:inline">{CHECK_LABELS[check]}</span>
            </>
          )}
        </span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="text-xs text-subtle">
          {check === "invalid"
            ? "3 to 24 lowercase letters, digits, dots or underscores, starting with a letter or digit."
            : "Old links keep working when you change it."}
        </span>
        <Counter length={value.length} max={USERNAME_MAX} />
      </div>
    </div>
  );
}
