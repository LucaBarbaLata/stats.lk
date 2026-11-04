import { eq } from "drizzle-orm";
import { Tags } from "lucide-react";
import type { Metadata } from "next";
import { SettingsForm } from "@/components/settings-form";
import { SettingsCard, SettingsHeader } from "@/components/settings-ui";
import { SpotifyIcon } from "@/components/spotify-button";
import { buttonClass } from "@/components/ui";
import { db } from "@/lib/db";
import { spotifyTokens } from "@/lib/db/schema";
import { formatDate } from "@/lib/dates";
import { formatRelative } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { disconnectSpotify, syncNowFromSettings } from "../actions";

export const metadata: Metadata = { title: "Connections" };

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-right text-sm">{value}</dd>
    </div>
  );
}

export default async function ConnectionsPage() {
  const user = await requireUser();
  const [token] = await db
    .select({ revokedAt: spotifyTokens.revokedAt })
    .from(spotifyTokens)
    .where(eq(spotifyTokens.userId, user.id));
  const status = !token ? "Disconnected" : token.revokedAt ? "Access removed in Spotify" : "Connected";

  return (
    <>
      <SettingsHeader title="Connections" description="The services stats.lk gets your music from." />
      <SettingsCard icon={SpotifyIcon} title="Spotify" description="Where your plays come from. stats.lk only reads; it can't change anything in your account.">
        <dl className="divide-y divide-border/60">
          <Row
            label="Status"
            value={
              <span className={`flex items-center gap-2 ${status === "Connected" ? "text-accent" : "text-red-300"}`}>
                <span className={`size-2 rounded-full ${status === "Connected" ? "bg-accent" : "bg-red-400"}`} />
                {status}
              </span>
            }
          />
          <Row label="Account" value={user.displayName} />
          <Row label="Connected since" value={formatDate(user.createdAt)} />
          <Row label="Last sync" value={user.lastSyncedAt ? formatRelative(user.lastSyncedAt) : "Never"} />
          {user.syncError && <Row label="Last error" value={<span className="text-red-300">{user.syncError}</span>} />}
        </dl>
        <div className="flex flex-wrap items-start gap-2">
          <SettingsForm action={syncNowFromSettings} submitLabel="Sync now" pendingLabel="Syncing…" variant="secondary" />
          <form action={disconnectSpotify}>
            <button className={buttonClass("ghost")}>Disconnect</button>
          </form>
        </div>
        <p className="text-sm text-pretty text-muted">
          Disconnecting stops saving your plays and logs you out everywhere. Your stats stay, and logging in again
          reconnects. To remove the permission on Spotify&apos;s side too, use your{" "}
          <a
            href="https://www.spotify.com/account/apps/"
            target="_blank"
            rel="noreferrer"
            className="text-foreground underline underline-offset-2 hover:text-accent"
          >
            Spotify apps page
          </a>
          .
        </p>
      </SettingsCard>

      <SettingsCard icon={Tags} title="Last.fm" description="Used only for artist genres, looked up by artist name. Nothing about you is sent and you don't need an account." >
        <p className="text-sm text-muted">Nothing to set up.</p>
      </SettingsCard>
    </>
  );
}
