import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StatCard } from "@/components/stat-card";
import { PageHeader } from "@/components/ui";
import { getAdminUsers, getSystemStats } from "@/lib/admin";
import { isAdmin } from "@/lib/env";
import { formatNumber, formatRelative } from "@/lib/format";
import { requireUser } from "@/lib/session";

// Spotify Development Mode allows this many users per app
const DEV_MODE_USER_LIMIT = 5;

const relative = (ms: number | null) => (ms ? formatRelative(new Date(ms)) : "never");

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  const user = await requireUser();
  if (!isAdmin(user.spotifyId)) notFound();
  const [users, stats] = await Promise.all([getAdminUsers(), getSystemStats()]);
  const { workerOk } = stats;

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
          label="Users"
          value={`${users.length} / ${DEV_MODE_USER_LIMIT}`}
          detail="Spotify Development Mode limit"
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
                    {row.tokenRevoked ? (
                      <span className="text-red-300">Spotify access revoked</span>
                    ) : row.syncError ? (
                      <span className="text-red-300" title={row.syncError}>
                        Sync failing
                      </span>
                    ) : (
                      <span className="text-muted">OK</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-muted">
          New users must first be added under User Management in the{" "}
          <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer" className="text-accent hover:underline">
            Spotify developer dashboard
          </a>
          .
        </p>
      </section>
    </div>
  );
}
