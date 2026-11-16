import { eq } from "drizzle-orm";
import { Check, Tags } from "lucide-react";
import type { Metadata } from "next";
import { SettingsForm } from "@/components/settings-form";
import { SettingsCard, SettingsHeader } from "@/components/settings-ui";
import { SpotifyIcon } from "@/components/spotify-button";
import { buttonClass } from "@/components/ui";
import { db } from "@/lib/db";
import { spotifyTokens } from "@/lib/db/schema";
import { formatRelative } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { disconnectSpotify, syncNowFromSettings } from "../actions";

export const metadata: Metadata = { title: "Connections" };

// From /api/auth/callback, after trying to connect
const CONNECT_ERRORS: Record<string, string> = {
  denied: "You cancelled connecting Spotify.",
  state: "That took too long. Try again.",
  not_allowlisted:
    "Spotify said no: this Spotify account isn't one of the 5 that stats.lk can connect. Your imported history works the same without it.",
  taken: "That Spotify account already has its own stats.lk account, and accounts can't be merged. Log in with Spotify to use that one.",
  other: "Your account is tied to a different Spotify account. Log in to Spotify with that one and try again.",
  login: "Connecting didn't work. Try again.",
};

const linkClass = "text-foreground underline underline-offset-2 hover:text-accent";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-right text-sm">{value}</dd>
    </div>
  );
}

function ConnectButton({ label }: { label: string }) {
  // A plain link: the OAuth flow starts with a redirect to Spotify
  return (
    <a href="/api/auth/login?connect=1" className={buttonClass("secondary")}>
      <SpotifyIcon className="size-4 text-[#1DB954]" />
      {label}
    </a>
  );
}

export default async function ConnectionsPage({ searchParams }: PageProps<"/settings/connections">) {
  const [user, query] = await Promise.all([requireUser(), searchParams]);
  const [token] = await db
    .select({ revokedAt: spotifyTokens.revokedAt })
    .from(spotifyTokens)
    .where(eq(spotifyTokens.userId, user.id));
  const status = !token ? "Not connected" : token.revokedAt ? "Access removed in Spotify" : "Connected";
  // Accounts with their own login stay logged in when Spotify goes
  const ownLogin = Boolean(user.email && user.passwordHash);
  const error = typeof query.error === "string" ? CONNECT_ERRORS[query.error] : undefined;

  return (
    <>
      <SettingsHeader title="Connections" description="The services stats.lk gets your music from." />
      <SettingsCard icon={SpotifyIcon} title="Spotify" description="Live stats: plays as you listen, what you're playing now, and Spotify's own top lists. stats.lk only reads; it can't change anything in your account.">
        {error && (
          <p role="alert" className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-pretty text-red-200 ring-1 ring-red-500/25 ring-inset">
            {error}
          </p>
        )}
        {query.connected === "1" && token && !token.revokedAt && (
          <p role="status" className="flex items-center gap-1.5 text-sm text-accent">
            <Check className="size-4" />
            Spotify connected. New plays show up on their own now.
          </p>
        )}
        <dl className="divide-y divide-border/60">
          <Row
            label="Status"
            value={
              <span
                className={`flex items-center gap-2 ${status === "Connected" ? "text-accent" : status === "Not connected" ? "text-muted" : "text-red-300"}`}
              >
                <span
                  className={`size-2 rounded-full ${status === "Connected" ? "bg-accent" : status === "Not connected" ? "bg-subtle" : "bg-red-400"}`}
                />
                {status}
              </span>
            }
          />
          {token && user.spotifyId && (
            <Row
              label="Account"
              value={
                <a href={`https://open.spotify.com/user/${encodeURIComponent(user.spotifyId)}`} target="_blank" rel="noreferrer" className={linkClass}>
                  Open on Spotify
                </a>
              }
            />
          )}
          {token && <Row label="Last sync" value={user.lastSyncedAt ? formatRelative(user.lastSyncedAt) : "Never"} />}
          {token && user.syncError && <Row label="Last error" value={<span className="text-red-300">{user.syncError}</span>} />}
        </dl>

        {!token ? (
          <>
            <div>
              <ConnectButton label="Connect Spotify" />
            </div>
            <p className="text-sm text-pretty text-muted">
              Spotify lets small apps like stats.lk connect only 5 accounts, added by hand, so this works only if yours is
              one of them. Everything else comes from the history you import, with or without Spotify.
            </p>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-start gap-2">
              {token.revokedAt ? (
                <ConnectButton label="Connect again" />
              ) : (
                <SettingsForm action={syncNowFromSettings} submitLabel="Sync now" pendingLabel="Syncing…" variant="secondary" />
              )}
              <form action={disconnectSpotify}>
                <button className={buttonClass("ghost")}>Disconnect</button>
              </form>
            </div>
            <p className="text-sm text-pretty text-muted">
              {ownLogin
                ? "Disconnecting stops saving new plays. Your stats stay, and you can connect again here."
                : "Disconnecting stops saving your plays and logs you out everywhere. Your stats stay, and logging in again reconnects."}{" "}
              To remove the permission on Spotify&apos;s side too, use your{" "}
              <a href="https://www.spotify.com/account/apps/" target="_blank" rel="noreferrer" className={linkClass}>
                Spotify apps page
              </a>
              .
            </p>
          </>
        )}
      </SettingsCard>

      <SettingsCard icon={Tags} title="Last.fm" description="Used only for artist genres, looked up by artist name. Nothing about you is sent and you don't need an account." >
        <p className="text-sm text-muted">Nothing to set up.</p>
      </SettingsCard>
    </>
  );
}
