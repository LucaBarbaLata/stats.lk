"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { pollNowPlaying } from "@/app/actions";
import { Cover } from "@/components/cover";
import { TRACK_CHANGE_EVENT } from "@/components/live-sync";
import type { NowPlayingEntry } from "@/lib/social";

const POLL_MS = 15_000;

function useNowPlaying(userIds: string[], initial: NowPlayingEntry[], live = true) {
  const [entries, setEntries] = useState(initial);
  const key = userIds.join(",");
  useEffect(() => {
    if (!live) return;
    let cancelled = false;
    const poll = () =>
      pollNowPlaying(key.split(",").filter(Boolean))
        .then((next) => !cancelled && setEntries(next))
        .catch(() => {});
    const timer = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [key, live]);
  return entries;
}

// Ticks every second so the progress bar moves between polls. Starts at
// null so the server render and the first client render match (reading the
// clock during render would differ between the two).
function useNow(active: boolean) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [active]);
  return now;
}

function Progress({ entry, now }: { entry: NowPlayingEntry; now: number | null }) {
  if (!entry.durationMs || entry.progressMs === null) return null;
  const elapsed = entry.isPlaying && now !== null ? now - entry.fetchedMs : 0;
  const progress = Math.max(0, Math.min(1, (entry.progressMs + elapsed) / entry.durationMs));
  return (
    <div className="h-1 overflow-hidden rounded-full bg-surface-3">
      <div className="h-full rounded-full bg-accent" style={{ width: `${progress * 100}%` }} />
    </div>
  );
}

function Equalizer({ playing }: { playing: boolean }) {
  return (
    <span aria-hidden className="inline-flex h-3 items-end gap-0.5">
      {[0, 1, 2].map((bar) => (
        <span
          key={bar}
          className={`w-0.5 rounded-full bg-accent ${playing ? "animate-pulse" : ""}`}
          style={{ height: `${[60, 100, 40][bar]}%`, animationDelay: `${bar * 150}ms` }}
        />
      ))}
    </span>
  );
}

// The viewer's own now playing, as a card. Renders nothing when idle.
export function MyNowPlaying({ userId, initial }: { userId: string; initial: NowPlayingEntry[] }) {
  const [entry] = useNowPlaying([userId], initial);
  const now = useNow(Boolean(entry?.isPlaying));

  // A new track (or none) means the last one was just played: tell LiveSync
  const trackId = entry?.trackId;
  const previousTrack = useRef(trackId);
  useEffect(() => {
    if (previousTrack.current && previousTrack.current !== trackId) {
      window.dispatchEvent(new Event(TRACK_CHANGE_EVENT));
    }
    previousTrack.current = trackId;
  }, [trackId]);

  if (!entry) return null;
  return (
    <Link
      href={`/track/${entry.trackId}`}
      className="flex animate-rise items-center gap-4 rounded-3xl bg-surface p-3 pr-5 ring-1 ring-accent/15 transition ring-inset hover:bg-surface-2 sm:gap-5"
    >
      <div className="w-16 shrink-0 sm:w-20">
        <Cover src={entry.imageUrl} size={80} label={entry.trackName} />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="flex items-center gap-2 text-sm text-accent">
          <Equalizer playing={entry.isPlaying} />
          {entry.isPlaying ? "Playing now" : "Paused"}
        </p>
        <div>
          <p className="truncate text-lg leading-tight font-semibold">{entry.trackName}</p>
          <p className="truncate text-sm text-muted">{entry.artistNames}</p>
        </div>
        <Progress entry={entry} now={now} />
      </div>
    </Link>
  );
}

// Friends' now playing as a compact list. Renders a hint when nobody is
// listening. Visitors who aren't logged in get a snapshot (`live` false).
export function FriendsNowPlaying({
  userIds,
  initial,
  live = true,
}: {
  userIds: string[];
  initial: NowPlayingEntry[];
  live?: boolean;
}) {
  const entries = useNowPlaying(userIds, initial, live);
  const now = useNow(entries.some((entry) => entry.isPlaying));
  if (!entries.length) return <p className="rounded-2xl bg-surface px-5 py-4 text-sm text-muted">None of your friends is listening right now.</p>;
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {entries.map((entry) => (
        <li key={entry.userId} className="flex items-center gap-3 rounded-2xl bg-surface p-3">
          <Cover src={entry.imageUrl} size={48} label={entry.trackName} />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="flex items-center gap-2 truncate text-sm">
              <Equalizer playing={entry.isPlaying} />
              <Link href={`/u/${entry.username}`} className="font-medium hover:underline">
                {entry.displayName}
              </Link>
              <span className="text-muted">{entry.isPlaying ? "is listening to" : "paused"}</span>
            </p>
            <Link href={`/track/${entry.trackId}`} className="block truncate font-semibold hover:underline">
              {entry.trackName}
            </Link>
            <p className="truncate text-sm text-muted">{entry.artistNames}</p>
            <Progress entry={entry} now={now} />
          </div>
        </li>
      ))}
    </ul>
  );
}
