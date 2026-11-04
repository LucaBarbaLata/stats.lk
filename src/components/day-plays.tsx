"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { loadDayPlays } from "@/app/(app)/activity/actions";
import { Cover } from "@/components/cover";
import { formatMinutes, formatNumber } from "@/lib/format";
import type { DayPlay } from "@/lib/stats";

// A window listing one day's plays, oldest first. A native <dialog> traps
// focus and closes on Escape; `key` it by date so each day starts fresh.
export function DayPlays({ date, label, onClose }: { date: string; label: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [plays, setPlays] = useState<DayPlay[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadDayPlays(date)
      .then((rows) => {
        if (!cancelled) setPlays(rows);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [date]);

  const close = () => dialog.current?.close();
  const totalMs = plays?.reduce((total, play) => total + play.msPlayed, 0) ?? 0;

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onClose={onClose}
      // Only the backdrop has the dialog itself as its target
      onClick={(event) => {
        if (event.target === dialog.current) close();
      }}
      className="m-auto max-h-[min(42rem,calc(100dvh-2rem))] w-[min(34rem,calc(100vw-2rem))] animate-page flex-col overflow-hidden rounded-3xl border border-border bg-surface text-foreground shadow-2xl shadow-black/50 backdrop:bg-black/60 backdrop:backdrop-blur-sm open:flex"
    >
      <header className="flex items-start justify-between gap-4 border-b border-border/70 px-5 py-4">
        <div className="min-w-0">
          <h2 id={titleId} className="text-lg font-semibold tracking-tight">
            {label}
          </h2>
          <p className="text-sm text-muted tabular-nums" aria-live="polite">
            {plays
              ? `${formatNumber(plays.length)} ${plays.length === 1 ? "play" : "plays"}, ${formatMinutes(totalMs)} min`
              : failed
                ? "Couldn't load this day"
                : "Loading…"}
          </p>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted transition hover:bg-surface-3 hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {failed ? (
          <p className="px-2 py-6 text-center text-sm text-muted">Something went wrong. Close this and try the day again.</p>
        ) : !plays ? (
          <ul aria-hidden className="animate-pulse divide-y divide-border/60">
            {[0, 1, 2, 3, 4].map((row) => (
              <li key={row} className="flex items-center gap-3 px-2 py-2.5">
                <div className="h-3 w-10 rounded bg-surface-2" />
                <div className="size-11 rounded-md bg-surface-2" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-2/3 rounded bg-surface-2" />
                  <div className="h-3 w-1/3 rounded bg-surface-2" />
                </div>
              </li>
            ))}
          </ul>
        ) : plays.length ? (
          <ol className="divide-y divide-border/60">
            {plays.map((play, index) => (
              <li key={play.id} className="animate-rise py-0.5" style={{ animationDelay: `${Math.min(index, 12) * 25}ms` }}>
                <Link href={`/track/${play.trackId}`} className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition hover:bg-surface-2">
                  <span className="w-10 shrink-0 text-sm text-muted tabular-nums">{play.time}</span>
                  <Cover src={play.imageUrl} size={44} label={play.trackName} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{play.trackName}</span>
                    <span className="block truncate text-sm text-muted">{play.artistNames}</span>
                  </span>
                  <span className="shrink-0 text-sm text-subtle tabular-nums">{formatMinutes(play.msPlayed)} min</span>
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <p className="px-2 py-6 text-center text-sm text-muted">No plays saved for this day.</p>
        )}
      </div>
    </dialog>
  );
}
