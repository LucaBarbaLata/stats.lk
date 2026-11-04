import { Download, History, Trash2, TriangleAlert, Upload } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { deleteAccount } from "@/app/actions";
import { SettingsForm } from "@/components/settings-form";
import { inputClass, SettingsCard, SettingsHeader } from "@/components/settings-ui";
import { buttonClass } from "@/components/ui";
import { formatNumber } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { getListeningTotals } from "@/lib/stats";
import { deleteImportedHistory } from "../actions";

export const metadata: Metadata = { title: "Your data" };

export default async function DataSettingsPage({ searchParams }: PageProps<"/settings/data">) {
  const query = await searchParams;
  const user = await requireUser();
  const totals = await getListeningTotals(user.id);

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

      {totals.importedStreams > 0 && (
        <SettingsCard
          icon={Trash2}
          title="Delete imported history"
          description="Removes the plays that came from Spotify's export, for example to import a newer file from scratch. Plays saved since you joined stay."
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
