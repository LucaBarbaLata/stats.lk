"use client";

import { BellOff, Eye, EyeOff, MailCheck } from "lucide-react";
import Link from "next/link";
import { useActionState, useId, useState, type ReactNode } from "react";
import {
  checkNewUsername,
  logInAction,
  requestResetAction,
  resendVerificationAction,
  resetPasswordAction,
  signUpAction,
  unsubscribeAction,
  verifyEmailAction,
  type AuthFormState,
} from "@/app/auth-actions";
import { UsernameField } from "@/components/profile-fields";
import { buttonClass, IconChip } from "@/components/ui";
import { EMAIL_MAX, PASSWORD_MAX, PASSWORD_MIN } from "@/lib/account-rules";

// The forms of the login, sign-up, email confirmation and password reset pages

const inputClass =
  "h-12 w-full rounded-xl bg-surface px-4 text-foreground ring-1 ring-border/70 transition ring-inset placeholder:text-subtle hover:ring-border-strong focus:ring-accent/60 focus:outline-none";

function Label({ htmlFor, children, aside }: { htmlFor: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {children}
      </label>
      {aside}
    </div>
  );
}

function EmailField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const id = useId();
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Email</Label>
      <input
        id={id}
        name="email"
        type="email"
        autoComplete="email"
        required
        maxLength={EMAIL_MAX}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass}
      />
    </div>
  );
}

function PasswordField({
  label = "Password",
  autoComplete,
  hint,
  aside,
}: {
  label?: string;
  autoComplete: "current-password" | "new-password";
  hint?: string;
  aside?: ReactNode;
}) {
  const id = useId();
  const [shown, setShown] = useState(false);
  return (
    <div className="space-y-2">
      <Label htmlFor={id} aside={aside}>
        {label}
      </Label>
      <div className="relative">
        <input
          id={id}
          name="password"
          type={shown ? "text" : "password"}
          autoComplete={autoComplete}
          required
          maxLength={PASSWORD_MAX}
          aria-describedby={hint ? `${id}-hint` : undefined}
          className={`${inputClass} pr-12`}
        />
        <button
          type="button"
          onClick={() => setShown(!shown)}
          aria-label={shown ? "Hide password" : "Show password"}
          aria-pressed={shown}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-subtle transition hover:text-foreground focus-visible:text-foreground"
        >
          {shown ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
        </button>
      </div>
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-subtle">
          {hint}
        </p>
      )}
    </div>
  );
}

function FormError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-200 ring-1 ring-red-500/25 ring-inset">
      {children}
    </p>
  );
}

function SubmitButton({ pending, pendingLabel, children }: { pending: boolean; pendingLabel: string; children: ReactNode }) {
  return (
    <button disabled={pending} className={`${buttonClass("primary")} h-12 w-full text-[15px] disabled:opacity-60`}>
      {pending ? pendingLabel : children}
    </button>
  );
}

// "Check your email": shown once a link is on its way
function LinkSent({ email, children }: { email: string; children?: ReactNode }) {
  return (
    <div role="status" className="flex flex-col items-center gap-4 rounded-2xl bg-surface p-6 text-center">
      <IconChip icon={MailCheck} size="lg" />
      <div className="space-y-1.5">
        <p className="text-lg font-semibold tracking-tight">Check your email</p>
        <p className="text-sm text-pretty text-muted">
          We sent an email to <span className="font-medium break-all text-foreground">{email}</span>. Open the link in it to
          continue. If it isn&apos;t there in a few minutes, look in spam.
        </p>
      </div>
      {children}
    </div>
  );
}

// "Send the link again", for an email that isn't confirmed yet
function ResendLink({ email }: { email: string }) {
  const [state, action, pending] = useActionState(resendVerificationAction, null);
  return (
    <form action={action} className="flex flex-col items-center gap-2 text-sm">
      <input type="hidden" name="email" value={email} />
      {state?.sentTo ? (
        <p role="status" className="text-accent">
          Sent again. The newest link is the one that works.
        </p>
      ) : (
        <button disabled={pending} className="font-medium text-accent hover:underline disabled:opacity-60">
          {pending ? "Sending…" : "Send the link again"}
        </button>
      )}
      {state?.error && <p className="text-red-300">{state.error}</p>}
    </form>
  );
}

export function LoginForm() {
  const [state, action, pending] = useActionState(logInAction, null);
  const [email, setEmail] = useState("");
  return (
    <div className="space-y-4">
      <form action={action} className="space-y-4">
        <EmailField value={email} onChange={setEmail} />
        <PasswordField
          autoComplete="current-password"
          aside={
            <Link href="/reset-password" className="text-sm text-muted hover:text-foreground">
              Forgot password?
            </Link>
          }
        />
        {state?.error && <FormError>{state.error}</FormError>}
        <SubmitButton pending={pending} pendingLabel="Logging in…">
          Log in
        </SubmitButton>
      </form>
      {state?.unconfirmed && <ResendLink email={email} />}
    </div>
  );
}

function SignUpAttempt({ host, onStartOver }: { host: string; onStartOver: () => void }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signUpAction, null);
  const [email, setEmail] = useState("");

  if (state?.sentTo) {
    return (
      <LinkSent email={state.sentTo}>
        <ResendLink email={state.sentTo} />
        <button type="button" onClick={onStartOver} className="text-sm text-muted hover:text-foreground">
          Use another email
        </button>
      </LinkSent>
    );
  }
  return (
    <form action={action} className="space-y-4">
      <EmailField value={email} onChange={setEmail} />
      <UsernameField
        host={host}
        defaultValue=""
        label="Username"
        hint="Your profile link. You can change it later."
        check={checkNewUsername}
      />
      <PasswordField autoComplete="new-password" hint={`At least ${PASSWORD_MIN} characters.`} />
      {state?.error && <FormError>{state.error}</FormError>}
      <SubmitButton pending={pending} pendingLabel="Creating your account…">
        Create account
      </SubmitButton>
    </form>
  );
}

export function SignUpForm({ host }: { host: string }) {
  // A new attempt starts with a fresh form
  const [attempt, setAttempt] = useState(0);
  return <SignUpAttempt key={attempt} host={host} onStartOver={() => setAttempt(attempt + 1)} />;
}

export function VerifyForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(verifyEmailAction, null);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <PasswordField autoComplete="current-password" hint="The one you chose for stats.lk." />
      {state?.error && (
        <FormError>
          {state.error}{" "}
          <Link
            href={state.wrongPassword ? "/reset-password" : "/login"}
            className="font-medium underline underline-offset-2"
          >
            {state.wrongPassword ? "Reset it" : "Log in"}
          </Link>
        </FormError>
      )}
      <SubmitButton pending={pending} pendingLabel="Confirming…">
        Confirm and log in
      </SubmitButton>
    </form>
  );
}

export function UnsubscribeForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(unsubscribeAction, null);
  if (state?.done) {
    return (
      <div role="status" className="flex flex-col items-center gap-4 rounded-2xl bg-surface p-6 text-center">
        <IconChip icon={BellOff} size="lg" />
        <div className="space-y-1.5">
          <p className="text-lg font-semibold tracking-tight">No more reminders</p>
          <p className="text-sm text-pretty text-muted">
            You can turn them back on in Settings, under Your data. Emails about your login, like password resets, still
            arrive.
          </p>
        </div>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      {state?.error && <FormError>{state.error}</FormError>}
      <SubmitButton pending={pending} pendingLabel="Stopping…">
        Stop reminder emails
      </SubmitButton>
    </form>
  );
}

export function RequestResetForm() {
  const [state, action, pending] = useActionState(requestResetAction, null);
  const [email, setEmail] = useState("");
  if (state?.sentTo) {
    return (
      <LinkSent email={state.sentTo}>
        <p className="text-sm text-subtle">If no account uses this email, nothing arrives. The link works for 1 hour.</p>
      </LinkSent>
    );
  }
  return (
    <form action={action} className="space-y-4">
      <p className="text-center text-sm text-pretty text-muted">
        Enter the email you signed up with and we&apos;ll send you a link to choose a new password.
      </p>
      <EmailField value={email} onChange={setEmail} />
      {state?.error && <FormError>{state.error}</FormError>}
      <SubmitButton pending={pending} pendingLabel="Sending…">
        Send the link
      </SubmitButton>
    </form>
  );
}

export function NewPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, null);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <PasswordField
        label="New password"
        autoComplete="new-password"
        hint={`At least ${PASSWORD_MIN} characters. Saving it logs you out on your other devices.`}
      />
      {state?.error && <FormError>{state.error}</FormError>}
      <SubmitButton pending={pending} pendingLabel="Saving…">
        Save and log in
      </SubmitButton>
    </form>
  );
}
