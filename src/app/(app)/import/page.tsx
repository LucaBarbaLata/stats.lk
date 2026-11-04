import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ImportProgress } from "@/components/import-progress";
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

      <ImportForm />

      <Suspense fallback={<div className="h-64 animate-pulse rounded-3xl bg-surface" />}>
        <ImportStatus />
      </Suspense>

      <p className="text-sm text-muted">
        Your files are read in your browser. Only the track, the time and how long you listened are
        sent to stats.lk. IP addresses and device info in the export never leave your device. Plays
        shorter than 30 seconds are skipped, and importing the same file twice won&apos;t create
        duplicates.
      </p>
    </div>
  );
}

async function ImportStatus() {
  const user = await requireUser();
  const progress = await getImportProgress(user.id);
  if (!progress.plays) return null;
  // A new import restarts the bar with the new numbers
  return <ImportProgress key={progress.plays} initial={progress} />;
}
