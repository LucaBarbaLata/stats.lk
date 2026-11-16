import { Check, KeyRound, Mail, MailCheck } from "lucide-react";
import type { Metadata } from "next";
import { PasswordInput, SettingsForm } from "@/components/settings-form";
import { inputClass, SettingsCard, SettingsHeader } from "@/components/settings-ui";
import { EMAIL_MAX, PASSWORD_MIN } from "@/lib/account-rules";
import { pendingEmail } from "@/lib/accounts";
import { requireUser } from "@/lib/session";
import { addLoginAction, changeEmailAction, changePasswordAction } from "../actions";

export const metadata: Metadata = { title: "Login" };

const NEW_PASSWORD_HINT = `At least ${PASSWORD_MIN} characters.`;

function EmailInput({ label }: { label: string }) {
  return (
    <label className="flex max-w-sm flex-col gap-2 text-sm text-muted">
      {label}
      <input name="email" type="email" autoComplete="email" required maxLength={EMAIL_MAX} className={inputClass} />
    </label>
  );
}

// A link went out and nobody opened it yet
function Pending({ email }: { email: string }) {
  return (
    <p role="status" className="flex items-start gap-3 rounded-2xl bg-surface-2 px-4 py-3 text-sm text-pretty text-muted">
      <MailCheck className="mt-0.5 size-4 shrink-0 text-accent" />
      <span>
        Waiting for you to confirm <span className="font-medium break-all text-foreground">{email}</span>. Open the link
        we sent there; it works for 24 hours. Not there? Look in spam, or send it again below.
      </span>
    </p>
  );
}

export default async function LoginSettingsPage({ searchParams }: PageProps<"/settings/login">) {
  const [user, query] = await Promise.all([requireUser(), searchParams]);
  const pending = await pendingEmail(user.id);
  const confirmed = query.confirmed === "1" && user.email;

  return (
    <>
      <SettingsHeader title="Login" description="How you get into your stats.lk account." />

      {user.email ? (
        <>
          <SettingsCard
            icon={Mail}
            title="Email"
            description={
              <>
                You log in with <span className="font-medium break-all text-foreground">{user.email}</span>. Password
                reset links go there too.
              </>
            }
          >
            {confirmed && !pending && (
              <p role="status" className="flex items-center gap-1.5 text-sm text-accent">
                <Check className="size-4" />
                Email confirmed. Log in with it from now on.
              </p>
            )}
            {pending && <Pending email={pending} />}
            <SettingsForm action={changeEmailAction} submitLabel="Change email" pendingLabel="Sending…" variant="secondary">
              <EmailInput label="New email" />
              <PasswordInput label="Your password" name="password" autoComplete="current-password" />
              <p className="text-sm text-pretty text-subtle">
                We&apos;ll send a link to the new address. Until you open it, you keep logging in with this one.
              </p>
            </SettingsForm>
          </SettingsCard>

          <SettingsCard icon={KeyRound} title="Password" description="Changing it logs you out on your other devices.">
            <SettingsForm action={changePasswordAction} submitLabel="Change password" pendingLabel="Saving…" variant="secondary">
              <PasswordInput label="Current password" name="current" autoComplete="current-password" />
              <PasswordInput label="New password" name="password" autoComplete="new-password" hint={NEW_PASSWORD_HINT} />
            </SettingsForm>
          </SettingsCard>
        </>
      ) : (
        <SettingsCard
          icon={KeyRound}
          title="Add an email and password"
          description="Optional. You log in with Spotify now; with these you can also log in without it, for example if Spotify access stops working one day."
        >
          {pending && <Pending email={pending} />}
          <SettingsForm action={addLoginAction} submitLabel={pending ? "Send again" : "Add"} pendingLabel="Sending…" variant="secondary">
            <EmailInput label="Email" />
            <PasswordInput label="Password" name="password" autoComplete="new-password" hint={NEW_PASSWORD_HINT} />
            <p className="text-sm text-pretty text-subtle">
              We&apos;ll send a link to confirm the address. Logging in with Spotify keeps working either way.
            </p>
          </SettingsForm>
        </SettingsCard>
      )}
    </>
  );
}
