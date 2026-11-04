import { Laptop, LogOut, MonitorSmartphone, Smartphone } from "lucide-react";
import type { Metadata } from "next";
import { SettingsForm } from "@/components/settings-form";
import { SettingsCard, SettingsHeader } from "@/components/settings-ui";
import { buttonClass } from "@/components/ui";
import { formatRelative } from "@/lib/format";
import { currentSessionId, listSessions, requireUser } from "@/lib/session";
import { logOutEverywhere, logOutOtherDevices } from "../actions";

export const metadata: Metadata = { title: "Sessions" };

// "Chrome on Windows" from a user agent string; good enough to tell devices apart
function describe(userAgent: string | null): { label: string; mobile: boolean } {
  if (!userAgent) return { label: "Unknown device", mobile: false };
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /OPR\//.test(userAgent)
      ? "Opera"
      : /Firefox\//.test(userAgent)
        ? "Firefox"
        : /Chrome\//.test(userAgent)
          ? "Chrome"
          : /Safari\//.test(userAgent)
            ? "Safari"
            : "A browser";
  const os = /Android/.test(userAgent)
    ? "Android"
    : /iPhone|iPad/.test(userAgent)
      ? "iOS"
      : /Windows/.test(userAgent)
        ? "Windows"
        : /Mac OS X/.test(userAgent)
          ? "macOS"
          : /Linux/.test(userAgent)
            ? "Linux"
            : "an unknown system";
  return { label: `${browser} on ${os}`, mobile: /Android|iPhone|iPad|Mobile/.test(userAgent) };
}

export default async function SessionsPage() {
  const user = await requireUser();
  const [sessions, currentId] = await Promise.all([listSessions(user.id), currentSessionId()]);

  return (
    <>
      <SettingsHeader title="Sessions" description="The browsers and devices logged in to your account." />
      <SettingsCard icon={MonitorSmartphone} title="Where you're logged in" description="Sessions last 30 days. Logging out ends them right away.">
        <ul className="-mx-2">
          {sessions.map((session) => {
            const device = describe(session.userAgent);
            const Icon = device.mobile ? Smartphone : Laptop;
            return (
              <li key={session.id} className="flex items-center gap-3 rounded-xl px-2 py-2.5">
                <span className="flex size-10 items-center justify-center rounded-full bg-surface-2 text-muted">
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {device.label}
                    {session.id === currentId && <span className="ml-2 text-sm font-normal text-accent">This device</span>}
                  </p>
                  <p className="text-sm text-subtle">Logged in {formatRelative(session.createdAt)}</p>
                </div>
              </li>
            );
          })}
        </ul>
        {sessions.length > 1 && (
          <SettingsForm action={logOutOtherDevices} submitLabel="Log out other devices" pendingLabel="Logging out…" variant="secondary" />
        )}
      </SettingsCard>

      <SettingsCard icon={LogOut} title="Log out everywhere" description="Ends every session, including this one.">
        <form action={logOutEverywhere}>
          <button className={buttonClass("secondary")}>Log out everywhere</button>
        </form>
      </SettingsCard>
    </>
  );
}
