import type { CSSProperties, ReactNode } from "react";
import { Cover } from "@/components/cover";
import type { CommunityStats } from "@/lib/community";
import { addDays, isoWeekday, today } from "@/lib/dates";
import { daypartOf, DAYPARTS } from "@/lib/series";

// Product previews for the presentation page, drawn from stats across all of
// stats.lk (see src/lib/community.ts). When there's nothing yet, sample data
// with colour tiles for covers stands in.

export interface PreviewArtist {
  name: string;
  imageUrl: string | null;
  plays: number;
  minutes: number;
  hue: number;
}

const SAMPLE_ARTISTS: PreviewArtist[] = [
  { name: "Northern Static", minutes: 1284, plays: 402, hue: 152, imageUrl: null },
  { name: "Ilinca Vale", minutes: 1037, plays: 351, hue: 24, imageUrl: null },
  { name: "The Paper Moons", minutes: 866, plays: 298, hue: 262, imageUrl: null },
  { name: "Coastal Signals", minutes: 702, plays: 240, hue: 198, imageUrl: null },
  { name: "Mira and the Tides", minutes: 655, plays: 219, hue: 330, imageUrl: null },
];

export function previewArtists(stats: CommunityStats | null): PreviewArtist[] {
  if (!stats?.topArtists.length) return SAMPLE_ARTISTS;
  return stats.topArtists.map((artist, index) => ({
    name: artist.name,
    imageUrl: artist.imageUrl,
    plays: artist.plays,
    minutes: Math.round(artist.minutes),
    hue: SAMPLE_ARTISTS[index % SAMPLE_ARTISTS.length].hue,
  }));
}

const delay = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });

// A cover made of colour, standing in for album art
export function ArtTile({ hue, size, round, className = "" }: { hue: number; size: number; round?: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={`block shrink-0 ${round ? "rounded-full" : "rounded-md"} ${className}`}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 30% 25%, hsl(${hue} 80% 70%), hsl(${hue + 30} 60% 38%) 55%, hsl(${hue + 50} 55% 16%))`,
      }}
    />
  );
}

export function ArtistImage({ artist, size }: { artist: PreviewArtist; size: number }) {
  return artist.imageUrl ? (
    <Cover src={artist.imageUrl} size={size} rounded label={artist.name} />
  ) : (
    <ArtTile hue={artist.hue} size={size} round />
  );
}

export function Panel({ children, className = "", style }: { children?: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div className={`rounded-3xl border border-border/70 bg-surface p-5 shadow-2xl shadow-black/40 ${className}`} style={style}>
      {children}
    </div>
  );
}

// Ranked list with a bar per row that grows in, like the Top pages.
// `start` delays the animation; `onView` waits until the list scrolls into view.
export function TopPreview({ rows, start = 0, onView }: { rows: PreviewArtist[]; start?: number; onView?: boolean }) {
  const max = Math.max(1, ...rows.map((row) => row.plays));
  const waiting = onView ? "[animation-play-state:paused] group-data-[inview=true]/view:[animation-play-state:running]" : "";
  return (
    <ol className="space-y-1.5">
      {rows.map((row, index) => (
        <li key={row.name} className="relative flex items-center gap-3 overflow-hidden rounded-xl px-2 py-1.5">
          <span
            aria-hidden
            className={`absolute inset-y-0 left-0 origin-left animate-grow-x rounded-xl bg-accent-fill/10 ${waiting}`}
            style={{ width: `${(row.plays / max) * 100}%`, ...delay(start + index * 110) }}
          />
          <span className="relative w-4 text-right text-sm text-subtle tabular-nums">{index + 1}</span>
          <span className={`relative animate-pop ${waiting}`} style={delay(start + 150 + index * 110)}>
            <ArtistImage artist={row} size={40} />
          </span>
          <span className="relative min-w-0 flex-1 truncate font-medium">{row.name}</span>
          <span className="relative text-right text-sm tabular-nums">
            <span className="block font-medium">{row.plays.toLocaleString("en-US")} plays</span>
            <span className="block text-subtle">{row.minutes.toLocaleString("en-US")} min</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

const HEAT = ["var(--surface-2)", "#14432a", "#1a7040", "#22a556", "#6ee7a0"];

// Weeks of days, Monday on top, ending this week. Real minutes per day when
// there are any, a made-up wave otherwise.
function heatDays(stats: CommunityStats | null, weeks: number): number[] {
  const last = addDays(today(), 7 - isoWeekday(today()));
  const first = addDays(last, -weeks * 7 + 1);
  const minutes = new Map((stats?.days ?? []).map((row) => [row.day, row.minutes]));
  const real = minutes.size > 0;
  return Array.from({ length: weeks * 7 }, (_, index) => {
    const day = addDays(first, index);
    if (day > today()) return -1;
    if (real) return minutes.get(day) ?? 0;
    return Math.max(0, Math.sin(index / 9) + Math.sin(index / 3.7) * 0.6 + ((index * 37) % 11) / 8) * 60;
  });
}

export function HeatmapPreview({
  stats,
  weeks = 26,
  start = 0,
  onView,
}: {
  stats: CommunityStats | null;
  weeks?: number;
  start?: number;
  onView?: boolean;
}) {
  const values = heatDays(stats, weeks);
  const waiting = onView ? "[animation-play-state:paused] group-data-[inview=true]/view:[animation-play-state:running]" : "";
  const positive = values.filter((value) => value > 0).sort((a, b) => a - b);
  const quartile = (q: number) => positive[Math.floor((positive.length - 1) * q)] ?? Infinity;
  const thresholds = [quartile(0.25), quartile(0.5), quartile(0.75)];
  return (
    <div aria-hidden className="grid grid-flow-col gap-[3px]" style={{ gridTemplateRows: "repeat(7, 10px)", gridAutoColumns: "10px" }}>
      {values.map((value, index) => {
        const level = value <= 0 ? 0 : 1 + thresholds.filter((threshold) => value > threshold).length;
        return (
          <span
            key={index}
            className={`animate-pop rounded-[3px] ${waiting}`}
            style={{
              background: value < 0 ? "transparent" : HEAT[level],
              // A wave from left to right
              ...delay(start + Math.floor(index / 7) * 28 + (index % 7) * 12),
            }}
          />
        );
      })}
    </div>
  );
}

export function HoursPreview({ stats, onView }: { stats: CommunityStats | null; onView?: boolean }) {
  const real = stats && stats.hours.some((minutes) => minutes > 0);
  const values = real ? stats.hours : [8, 5, 3, 2, 1, 1, 3, 9, 14, 12, 10, 11, 15, 13, 12, 14, 18, 22, 26, 30, 34, 38, 31, 18];
  const max = Math.max(1, ...values);
  const waiting = onView ? "[animation-play-state:paused] group-data-[inview=true]/view:[animation-play-state:running]" : "";
  return (
    <div aria-hidden className="space-y-3">
      <div className="flex h-28 items-end gap-[3px]">
        {values.map((value, hour) => (
          <span
            key={hour}
            className={`flex-1 origin-bottom animate-grow-y rounded-t-[3px] ${waiting}`}
            style={{
              height: `${Math.max(2, (value / max) * 100)}%`,
              background: daypartOf(hour).color,
              ...delay(hour * 35),
            }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {DAYPARTS.map((part) => (
          <span key={part.label} className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: part.color }} />
            {part.label}
          </span>
        ))}
      </div>
    </div>
  );
}
