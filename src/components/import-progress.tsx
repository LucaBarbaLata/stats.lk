"use client";

import { ChevronRight, CircleCheck, Hourglass, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { pollImportProgress } from "@/app/(app)/import/actions";
import { IconChip, ProgressBar } from "@/components/ui";
import { formatNumber } from "@/lib/format";
import type { ImportProgressData } from "@/lib/import/progress";

const POLL_MS = 4_000;

// Follows the worker until the history is complete, then re-renders the page
function useImportProgress(initial: ImportProgressData) {
  const router = useRouter();
  const [progress, setProgress] = useState(initial);
  const finished = progress.done;

  useEffect(() => {
    if (finished) return;
    const timer = setInterval(() => {
      pollImportProgress()
        .then((next) => {
          if (!next) return;
          setProgress(next);
          if (next.done) router.refresh();
        })
        .catch(() => {});
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [finished, router]);

  return progress;
}

function Step({ done, children, count }: { done: boolean; children: ReactNode; count?: string }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      {done ? (
        <CircleCheck className="size-5 shrink-0 text-accent" />
      ) : (
        <LoaderCircle className="size-5 shrink-0 animate-spin text-muted" />
      )}
      <span className={`min-w-0 flex-1 ${done ? "" : "text-muted"}`}>{children}</span>
      {count && <span className="shrink-0 text-sm text-subtle tabular-nums">{count}</span>}
    </li>
  );
}

const counted = ({ done, total }: { done: number; total: number }) => `${formatNumber(done)} of ${formatNumber(total)}`;

// The whole picture, on the import page
export function ImportProgress({ initial }: { initial: ImportProgressData }) {
  const progress = useImportProgress(initial);
  const { pictures, genres, spotify } = progress;
  const since =
    progress.firstPlayedMs &&
    new Date(progress.firstPlayedMs).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <section aria-label="Import progress" className="animate-rise space-y-4 rounded-3xl bg-surface p-5 sm:p-6">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0 space-y-0.5">
          <h2 className="text-lg font-semibold tracking-tight">
            {progress.done ? "Your history is in" : "Filling in your history"}
          </h2>
          <p className="text-sm text-pretty text-muted">
            {progress.done
              ? "Every stat now goes back to your first play."
              : "Your numbers are already right. Pictures and genres arrive by themselves, so you can leave this page."}
          </p>
        </div>
        <p className="shrink-0 text-[28px] leading-none font-semibold tabular-nums">{progress.percent}%</p>
      </div>

      <ProgressBar value={progress.percent / 100} label="History filled in" />

      <ul className="divide-y divide-border/60">
        <Step done count={formatNumber(progress.plays)}>
          Plays saved{since && `, going back to ${since}`}
        </Step>
        <Step done>Artists and albums linked</Step>
        <Step done={pictures.done >= pictures.total} count={counted(pictures)}>
          Covers and artist photos
        </Step>
        {genres && (
          <Step done={genres.done >= genres.total} count={counted(genres)}>
            Genres
          </Step>
        )}
      </ul>

      {!progress.done && !progress.workerActive && (
        <p className="flex items-center gap-2 text-sm text-amber-200">
          <Hourglass className="size-4 shrink-0" />
          Paused for the moment. It carries on by itself.
        </p>
      )}

      {spotify.done < spotify.total && (
        <p className="text-sm text-pretty text-subtle">
          Spotify then confirms each track, a few at a time, to add featured artists and release dates:{" "}
          {counted(spotify)} so far. Nothing you need to wait for.
        </p>
      )}
    </section>
  );
}

// A short version for the dashboard, only while there's something to wait for
export function ImportProgressBanner({ initial }: { initial: ImportProgressData }) {
  const progress = useImportProgress(initial);
  if (progress.done) return null;
  return (
    <Link
      href="/import"
      className="group block animate-rise space-y-3 rounded-2xl bg-surface p-4 transition hover:bg-surface-2"
    >
      <span className="flex items-center gap-3">
        <IconChip icon={LoaderCircle} />
        <span className="min-w-0 flex-1">
          <span className="block font-medium">Filling in your history</span>
          <span className="block truncate text-sm text-muted">Covers, photos and genres are on their way</span>
        </span>
        <span className="font-semibold tabular-nums">{progress.percent}%</span>
        <ChevronRight className="size-4 text-subtle transition group-hover:translate-x-0.5" />
      </span>
      <ProgressBar value={progress.percent / 100} label="History filled in" />
    </Link>
  );
}
