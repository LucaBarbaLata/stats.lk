import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StatCard } from "@/components/stat-card";
import { PageHeader } from "@/components/ui";
import { maxAccounts } from "@/lib/accounts";
import { getAdminUsers, getSystemStats, type AdminUser } from "@/lib/admin";
import { isAdmin } from "@/lib/env";
import { formatNumber, formatRelative } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { activePauses, type SpotifyCall } from "@/lib/spotify/pauses";

// Spotify Development Mode allows this many connected accounts per app
const DEV_MODE_USER_LIMIT = 5;

function Status({ user }: { user: AdminUser }) {
  if (user.unconfirmed) return <span className="text-muted">Email not confirmed</span>;
  if (user.spotify === "none") return <span className="text-muted">No Spotify</span>;
  if (user.spotify === "revoked") return <span className="text-red-300">Spotify access revoked</span>;
  if (!user.syncError) return <span className="text-muted">OK</span>;
  return (
    <span className="text-red-300" title={user.syncError}>
      Sync failing
    </span>
  );
}

const relative = (ms: number | null) => (ms ? formatRelative(new Date(ms)) : "never");

const PAUSED_NAMES: Record<SpotifyCall, string> = {
  "now-playing": "Now playing",
  "recently-played": "Saving new plays",
  "top-lists": "Spotify's top lists",
  catalog: "Artist and track details",
};

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  const user = await requireUser();
  if (!isAdmin(user.spotifyId)) notFound();
  const [users, stats, pauses] = await Promise.all([getAdminUsers(), getSystemStats(), activePauses()]);
  const { workerOk } = stats;
  const connected = users.filter((row) => row.spotify !== "none").length;

  return (
    <div className="space-y-10">
      <PageHeader title="Admin" description="How the app and the worker are doing." />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Worker"
          value={workerOk ? "Running" : "Not running"}
          detail={`Last seen ${relative(stats.lastBeatMs)}`}
          compact
        />
        <StatCard
          label="Accounts"
          value={`${users.length} / ${maxAccounts()}`}
          detail={`${connected} of ${DEV_MODE_USER_LIMIT} with Spotify`}
        />
        <StatCard label="Plays" value={formatNumber(stats.streams)} detail={`Last sync ${relative(stats.lastSyncMs)}`} />
        <StatCard
          label="Database"
          value={`${formatNumber(Math.round(stats.databaseBytes / 1024 / 1024))} MB`}
          detail={`${formatNumber(stats.friendships)} friendships`}
        />
        <StatCard
          label="Tracks"
          value={formatNumber(stats.tracks)}
          detail={`${formatNumber(stats.tracksPending)} waiting for Spotify details`}
        />
        <StatCard
          label="Artists"
          value={formatNumber(stats.artists)}
          detail={`${formatNumber(stats.artistsPending)} waiting for images, ${formatNumber(stats.genresPending)} for genres`}
        />
      </section>

      {!workerOk && (
        <p role="alert" className="rounded-2xl bg-red-500/10 px-5 py-4 text-sm text-red-200 ring-1 ring-red-500/25 ring-inset">
          The worker hasn&apos;t checked anything in the last 2 minutes. Plays aren&apos;t being saved:
          start it with <code className="font-mono">npm run worker</code> (or check the worker container).
        </p>
      )}

      {pauses.length > 0 && (
        <div role="alert" className="space-y-1 rounded-2xl bg-red-500/10 px-5 py-4 text-sm text-red-200 ring-1 ring-red-500/25 ring-inset">
          <p>Spotify asked us to wait, so these are paused. Everything else carries on.</p>
          <ul className="list-inside list-disc">
            {pauses.map((pause) => (
              <li key={pause.call}>
                {PAUSED_NAMES[pause.call]}: trying again {formatRelative(pause.until)} ({pause.reason})
              </li>
            ))}
          </ul>
        </div>
      )}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Users</h2>
        <div className="overflow-x-auto rounded-2xl bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-2 text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">User</th>
                <th className="px-4 py-2 font-medium">Joined</th>
                <th className="px-4 py-2 text-right font-medium">Plays</th>
                <th className="px-4 py-2 text-right font-medium">Imported</th>
                <th className="px-4 py-2 font-medium">Last play</th>
                <th className="px-4 py-2 font-medium">Last sync</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {users.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-2">
                    <Link href={`/u/${row.username}`} className="font-medium hover:underline">
                      {row.displayName}
                    </Link>
                    <span className="block text-xs text-muted">{row.visibility}</span>
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-muted">{relative(row.createdMs)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatNumber(row.streams)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatNumber(row.imported)}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-muted">{relative(row.lastPlayedMs)}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-muted">{relative(row.lastSyncedMs)}</td>
                  <td className="px-4 py-2">
                    <Status user={row} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-muted">
          Anyone can sign up with an email, up to the account limit. To connect Spotify, people must first be added under
          User Management in the{" "}
          <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer" className="text-accent hover:underline">
            Spotify developer dashboard
          </a>
          .
        </p>
      </section>
    </div>
  );
}
