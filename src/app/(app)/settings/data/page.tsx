import { Bell, Download, History, Trash2, TriangleAlert, Upload } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { deleteAccount } from "@/app/actions";
import { SettingsForm } from "@/components/settings-form";
import { inputClass, SettingsCard, SettingsHeader } from "@/components/settings-ui";
import { buttonClass } from "@/components/ui";
import { formatNumber } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { hasSpotifyTokens } from "@/lib/spotify/tokens";
import { getListeningTotals } from "@/lib/stats";
import { deleteImportedHistory, saveImportReminders } from "../actions";

export const metadata: Metadata = { title: "Your data" };

export default async function DataSettingsPage({ searchParams }: PageProps<"/settings/data">) {
  const query = await searchParams;
  const user = await requireUser();
  const [totals, live] = await Promise.all([getListeningTotals(user.id), hasSpotifyTokens(user.id)]);

  return (
    <>
      <SettingsHeader title="Your data" description="Import, download or delete everything stats.lk keeps about you." />
      <SettingsCard
        icon={History}
        title="Your history"
        description={`${formatNumber(totals.streams)} plays saved, ${formatNumber(totals.importedStreams)} of them imported from Spotify's export.`}
      >
        <div className="flex flex-wrap gap-2">
          <Link href="/import" className={buttonClass("secondary")}>
            <Upload className="size-4" /> Import history
          </Link>
          <a href="/api/export?format=csv" className={buttonClass("secondary")}>
            <Download className="size-4" /> Download CSV
          </a>
          <a href="/api/export?format=json" className={buttonClass("secondary")}>
            <Download className="size-4" /> Download JSON
          </a>
        </div>
        <p className="text-sm text-subtle">The JSON file also has your settings, friends and hidden items.</p>
      </SettingsCard>

      {/* With Spotify the stats keep themselves up to date */}
      {!live && (
        <SettingsCard
          icon={Bell}
          title="Import reminder"
          description="Your stats stop at the newest play in your last export. A reminder helps you keep them current."
        >
          <SettingsForm action={saveImportReminders} variant="secondary">
            <label className="flex items-center gap-4 rounded-2xl bg-surface-2 p-4">
              <span className="min-w-0 flex-1">
                <span className="block font-medium">Email me when my stats fall behind</span>
                <span className="block text-sm text-pretty text-muted">
                  Once a month while your newest play is more than 30 days old, with the steps to get a new export from
                  Spotify. Every email has a link to stop them.
                </span>
              </span>
              <input type="checkbox" name="importReminders" defaultChecked={user.importReminders} className="peer sr-only" />
              <span
                aria-hidden
                className="relative h-6 w-11 shrink-0 rounded-full bg-surface-3 transition peer-checked:bg-accent-fill peer-focus-visible:ring-2 peer-focus-visible:ring-accent/60 after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-foreground after:shadow after:transition peer-checked:after:translate-x-5"
              />
            </label>
          </SettingsForm>
        </SettingsCard>
      )}

      {totals.importedStreams > 0 && (
        <SettingsCard
          icon={Trash2}
          title="Delete imported history"
          description={`Removes the plays that came from Spotify's export, for example to import a newer file from scratch.${live ? " Plays saved since you joined stay." : ""}`}
        >
          <SettingsForm action={deleteImportedHistory} submitLabel="Delete imported plays" pendingLabel="Deleting…" variant="secondary">
            <label className="flex items-center gap-3 text-sm">
              <input type="checkbox" name="confirm" className="size-4 accent-accent-fill" />
              Yes, delete {formatNumber(totals.importedStreams)} imported plays
            </label>
          </SettingsForm>
        </SettingsCard>
      )}

      <div id="delete-account">
        <SettingsCard
          tone="danger"
          icon={TriangleAlert}
          title="Delete account"
          description="Deletes your account and all your data right away: plays, imports, friends, settings and Spotify tokens. This can't be undone."
        >
          <form action={deleteAccount} className="flex flex-wrap items-end gap-3">
            <label className="flex flex-1 flex-col gap-2 text-sm text-muted">
              <span>
                Type <span className="font-mono text-foreground">delete</span> to confirm
              </span>
              <input name="confirm" autoComplete="off" className={`${inputClass} max-w-60`} />
            </label>
            <button className={buttonClass("danger")}>Delete my account</button>
          </form>
          {query.error === "confirm" && (
            <p role="alert" className="text-sm text-red-300">
              Type &quot;delete&quot; in the box to confirm.
            </p>
          )}
        </SettingsCard>
      </div>
    </>
  );
}
