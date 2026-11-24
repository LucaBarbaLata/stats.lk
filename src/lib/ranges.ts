import { formatDate } from "./dates";

// Time ranges for the stats pages, read from ?range=4w|6m|1y|all or
// ?from=YYYY-MM-DD&to=YYYY-MM-DD (days in the app timezone).
//
// Presets count back from now, or from `endsAt` for accounts without
// Spotify: their stats stop at their newest imported play, so "the last 4
// weeks" are the 4 weeks before it (see getStatsEnd in src/lib/stats.ts).

export type SpotifyTerm = "short_term" | "medium_term" | "long_term";

export const PRESETS = [
  { key: "4w", label: "4 weeks", days: 28, spotifyTerm: "short_term" },
  { key: "6m", label: "6 months", days: 182, spotifyTerm: "medium_term" },
  { key: "1y", label: "1 year", days: 365, spotifyTerm: "long_term" },
  { key: "all", label: "All time", days: null, spotifyTerm: null },
] as const;

export type PresetKey = (typeof PRESETS)[number]["key"];

export type Range =
  | { key: PresetKey; label: string; days: number | null; spotifyTerm: SpotifyTerm | null; endsAt?: Date }
  | { key: "custom"; label: string; from: string; to: string };

type SearchParams = Record<string, string | string[] | undefined>;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

// A preset, ending now or at `endsAt`
export function presetRange(key: string, endsAt: Date | null = null): Range {
  const preset = PRESETS.find((option) => option.key === key) ?? PRESETS[0];
  return endsAt && preset.days ? { ...preset, endsAt } : { ...preset };
}

export function parseRange(params: SearchParams, fallback: Range["key"] = "4w", endsAt: Date | null = null): Range {
  const from = first(params.from);
  const to = first(params.to);
  if (from && to && DATE.test(from) && DATE.test(to) && from <= to) {
    return { key: "custom", label: `${from} – ${to}`, from, to };
  }
  const key = first(params.range);
  const known = PRESETS.some((preset) => preset.key === key) ? key : fallback;
  return presetRange(known ?? "4w", endsAt);
}

// "Last 4 weeks", "4 weeks to Oct 3, 2026", "All time" or the custom dates
export function rangeLabel(range: Range): string {
  if (range.key === "custom") return range.label;
  if (!range.days) return "All time";
  return range.endsAt ? `${range.label} to ${formatDate(range.endsAt)}` : `Last ${range.label.toLowerCase()}`;
}

// Query string for links that keep the current range
export function rangeQuery(range: Range): string {
  return range.key === "custom"
    ? `from=${range.from}&to=${range.to}`
    : `range=${range.key}`;
}

// Start of the range, for presets with a fixed length
export function rangeStart(range: Range): Date | null {
  if (range.key === "custom") return new Date(`${range.from}T00:00:00Z`);
  return range.days ? new Date((range.endsAt?.getTime() ?? Date.now()) - range.days * 24 * 60 * 60 * 1000) : null;
}

export const ALL_TIME: Range = { key: "all", label: "All time", days: null, spotifyTerm: null };
