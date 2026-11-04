// Time ranges for the stats pages, read from ?range=4w|6m|1y|all or
// ?from=YYYY-MM-DD&to=YYYY-MM-DD (days in the app timezone).

export type SpotifyTerm = "short_term" | "medium_term" | "long_term";

export const PRESETS = [
  { key: "4w", label: "4 weeks", days: 28, spotifyTerm: "short_term" },
  { key: "6m", label: "6 months", days: 182, spotifyTerm: "medium_term" },
  { key: "1y", label: "1 year", days: 365, spotifyTerm: "long_term" },
  { key: "all", label: "All time", days: null, spotifyTerm: null },
] as const;

export type Range =
  | { key: "4w" | "6m" | "1y" | "all"; label: string; days: number | null; spotifyTerm: SpotifyTerm | null }
  | { key: "custom"; label: string; from: string; to: string };

type SearchParams = Record<string, string | string[] | undefined>;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export function parseRange(params: SearchParams, fallback: Range["key"] = "4w"): Range {
  const from = first(params.from);
  const to = first(params.to);
  if (from && to && DATE.test(from) && DATE.test(to) && from <= to) {
    return { key: "custom", label: `${from} – ${to}`, from, to };
  }
  const key = first(params.range);
  return { ...(PRESETS.find((preset) => preset.key === key) ?? PRESETS.find((p) => p.key === fallback) ?? PRESETS[0]) };
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
  return range.days ? new Date(Date.now() - range.days * 24 * 60 * 60 * 1000) : null;
}

export const ALL_TIME: Range = { key: "all", label: "All time", days: null, spotifyTerm: null };
