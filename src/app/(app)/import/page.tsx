import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ImportProgress } from "@/components/import-progress";
import { IconChip } from "@/components/ui";
import { getImportCheck } from "@/lib/import/check";
import { getImportProgress } from "@/lib/import/progress";
import { requireUser } from "@/lib/session";
import { ImportForm } from "./import-form";

export const metadata: Metadata = { title: "Import history" };

export default function ImportPage() {
  return (
    <div className="max-w-2xl space-y-8">
      <div className="space-y-3">
        <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.02em] sm:text-[34px]">Import your full history</h1>
        <p className="text-muted">
          Upload the &quot;Extended streaming history&quot; export from Spotify to get stats from the
          day you created your account. Don&apos;t have it yet?{" "}
          <Link href="/guide" className="text-accent hover:underline">
            Here&apos;s how to get it
          </Link>
          .
        </p>
      </div>

      <div className="flex items-start gap-4 rounded-2xl bg-surface p-4 sm:p-5">
        <IconChip icon={ShieldCheck} />
        <div className="min-w-0 space-y-1">
          <p className="font-medium">Only your plays leave the ZIP</p>
          <p className="text-sm text-pretty text-muted">
            Your browser reads the file. stats.lk gets just the track, when you played it and for how long. Everything
            else in the export, like searches, playlists, messages, your email, IP addresses and devices, stays on your
            device.
          </p>
        </div>
      </div>

      <ImportForm />

      <Suspense fallback={<div className="h-64 animate-pulse rounded-3xl bg-surface" />}>
        <ImportStatus />
      </Suspense>

      <p className="text-sm text-muted">
        Plays shorter than 30 seconds are skipped. Importing the same file twice, or a newer export that overlaps an
        older one, won&apos;t create duplicates: only new plays are added.
      </p>
    </div>
  );
}

async function ImportStatus() {
  const user = await requireUser();
  const [progress, check] = await Promise.all([getImportProgress(user.id), getImportCheck(user.id)]);
  if (!progress.plays) return null;
  return (
    <div className="space-y-4">
      {check?.unusual && (
        <p role="status" className="rounded-2xl bg-amber-500/10 px-4 py-3 text-sm text-pretty text-amber-100 ring-1 ring-amber-500/25 ring-inset">
          Some of your imported plays look unusual, for example longer than their track or overlapping. They count in
          your own stats, but not in the totals on the home page.
        </p>
      )}
      {/* A new import restarts the bar with the new numbers */}
      <ImportProgress key={progress.plays} initial={progress} />
    </div>
  );
}
