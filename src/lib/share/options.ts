import { PRESETS } from "../ranges";
import { THEME_KEYS, type ThemeKey } from "./themes";

// What a share card shows and how it looks. The share page and the image
// route read the same query string; anything unknown falls back to a default.

export const CARDS = [
  { key: "top-artists", label: "Top artists" },
  { key: "top-tracks", label: "Top tracks" },
  { key: "top-albums", label: "Top albums" },
  { key: "wrapped", label: "Wrapped" },
  { key: "custom", label: "Custom" },
] as const;

export type CardKey = (typeof CARDS)[number]["key"];
export type RankingCard = Extract<CardKey, `top-${string}`>;

export const isRanking = (card: CardKey): card is RankingCard => card.startsWith("top-");

// Top lists, with how many items each layout shows
export const RANKING_LAYOUTS = [
  { key: "list", label: "List", items: 5 },
  { key: "grid", label: "Grid", items: 9 },
  { key: "podium", label: "Podium", items: 5 },
  { key: "poster", label: "Poster", items: 5 },
  { key: "type", label: "Type", items: 10 },
] as const;

// Wrapped and custom cards
export const SUMMARY_LAYOUTS = [
  { key: "stack", label: "Stack" },
  { key: "tiles", label: "Tiles" },
  { key: "poster", label: "Poster" },
] as const;

export type RankingLayout = (typeof RANKING_LAYOUTS)[number]["key"];
export type SummaryLayout = (typeof SUMMARY_LAYOUTS)[number]["key"];

export const layoutsFor = (card: CardKey) => (isRanking(card) ? RANKING_LAYOUTS : SUMMARY_LAYOUTS);

// The stats a custom card can show, in the order they appear on it
export const STATS = [
  { key: "minutes", label: "Minutes listened", kind: "number" },
  { key: "plays", label: "Plays", kind: "number" },
  { key: "artists", label: "Artists", kind: "number" },
  { key: "tracks", label: "Different tracks", kind: "number" },
  { key: "top-genre", label: "Top genre", kind: "number" },
  { key: "streak", label: "Longest streak", kind: "number" },
  { key: "busiest-day", label: "Biggest day", kind: "number" },
  { key: "peak-hour", label: "Favourite hour", kind: "number" },
  { key: "level", label: "Level", kind: "number" },
  { key: "trophies", label: "Trophies", kind: "number" },
  { key: "top-artist", label: "Top artist", kind: "feature" },
  { key: "top-track", label: "Top track", kind: "feature" },
  { key: "top-album", label: "Top album", kind: "feature" },
  { key: "artists-list", label: "Top 5 artists", kind: "list" },
  { key: "tracks-list", label: "Top 5 tracks", kind: "list" },
] as const;

export type StatKey = (typeof STATS)[number]["key"];
export type StatKind = (typeof STATS)[number]["kind"];

const STAT_KIND = Object.fromEntries(STATS.map((stat) => [stat.key, stat.kind])) as Record<StatKey, StatKind>;

export const MAX_STATS = 6;
export const DEFAULT_STATS: StatKey[] = ["minutes", "plays", "top-artist", "tracks-list"];
export const WRAPPED_STATS: StatKey[] = ["minutes", "top-genre", "top-artist", "tracks-list"];
export const DEFAULT_TITLE = "My stats";
export const MAX_TITLE = 32;

export type RangeKey = (typeof PRESETS)[number]["key"];

export interface ShareConfig {
  card: CardKey;
  layout: RankingLayout | SummaryLayout;
  theme: ThemeKey;
  // Top lists
  range: RangeKey;
  // Wrapped
  year: number;
  // Custom: a range key or a year
  period: string;
  title: string;
  stats: StatKey[];
}

type Params = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const isYear = (value: string | undefined) => /^\d{4}$/.test(value ?? "");

export function cleanTitle(value: string | undefined): string {
  const title = (value ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_TITLE);
  return title || DEFAULT_TITLE;
}

// `stats` comes as "a,b" from links and as repeated keys from the form. Kept
// in display order and capped; missing means the defaults, empty means none.
export function parseStats(value: string | string[] | undefined): StatKey[] {
  if (value === undefined) return DEFAULT_STATS;
  const wanted = new Set((Array.isArray(value) ? value : [value]).flatMap((part) => part.split(",")));
  return STATS.filter((stat) => wanted.has(stat.key))
    .map((stat) => stat.key)
    .slice(0, MAX_STATS);
}

export function parseShareConfig(params: Params, defaultYear: number): ShareConfig {
  const card = CARDS.find((option) => option.key === first(params.card))?.key ?? "top-artists";
  const layouts: readonly { key: string }[] = layoutsFor(card);
  const layout = (layouts.find((option) => option.key === first(params.layout)) ?? layouts[0]).key as ShareConfig["layout"];
  const theme = THEME_KEYS.find((key) => key === first(params.theme)) ?? "classic";
  const range = PRESETS.find((preset) => preset.key === first(params.range))?.key ?? "4w";
  const year = isYear(first(params.year)) ? Number(first(params.year)) : defaultYear;
  const period = first(params.period);
  return {
    card,
    layout,
    theme,
    range,
    year,
    period: period && (isYear(period) || PRESETS.some((preset) => preset.key === period)) ? period : "4w",
    title: cleanTitle(first(params.title)),
    stats: parseStats(params.stats),
  };
}

// The query string for the image (and the share page), with only what the
// card uses
export function shareQuery(config: ShareConfig): string {
  const query: Record<string, string> = { layout: config.layout, theme: config.theme };
  if (isRanking(config.card)) query.range = config.range;
  else if (config.card === "wrapped") query.year = String(config.year);
  else Object.assign(query, { period: config.period, title: config.title, stats: config.stats.join(",") });
  return new URLSearchParams(query).toString();
}

// ------------------------------------------------------------ the content

// Ready-to-draw content, made by src/lib/share/data.ts

export type ShareItem = { id: string; name: string; imageUrl: string | null; subtitle: string };

export type StatValue =
  | { kind: "number"; value: string; label: string }
  | { kind: "feature"; label: string; item: ShareItem | null; round?: boolean }
  | { kind: "list"; label: string; items: ShareItem[]; round?: boolean };

export type ShareData =
  | { kind: "ranking"; title: string; subtitle: string; items: ShareItem[]; round: boolean }
  | {
      kind: "summary";
      title: string;
      subtitle: string;
      stats: StatKey[];
      values: Partial<Record<StatKey, StatValue>>;
      // The top artist's picture, for the Poster layout and the Blur theme
      picture: string | null;
    };

// ----------------------------------------------------------- fitting stats

// How tall each kind of row is on a summary card, in pixels, and how much
// room there is under the title. Numbers sit two to a row.
// Keep in step with SUMMARY_SIZES in ./render.tsx.
const SPACE: Record<SummaryLayout, { room: number; gap: number } & Record<StatKind, number>> = {
  // Room: from under the subtitle to 40px above the footer
  stack: { room: 1360, gap: 48, number: 210, feature: 200, list: 515 },
  tiles: { room: 1360, gap: 24, number: 250, feature: 224, list: 550 },
  // The picture takes the top of the card. The top artist, already the
  // picture, is drawn without one.
  poster: { room: 995, gap: 44, number: 180, feature: 160, list: 480 },
};
const POSTER_TOP_ARTIST = 113;

export type StatRow = { kind: "numbers"; stats: StatKey[] } | { kind: "feature" | "list"; stats: [StatKey] };

// Lays the stats out in rows and leaves out whatever doesn't fit
export function planStats(layout: SummaryLayout, stats: StatKey[]): { rows: StatRow[]; dropped: StatKey[] } {
  const space = SPACE[layout];
  const candidates: StatRow[] = [];
  const numbers = stats.filter((stat) => STAT_KIND[stat] === "number");
  for (let index = 0; index < numbers.length; index += 2) {
    candidates.push({ kind: "numbers", stats: numbers.slice(index, index + 2) });
  }
  for (const stat of stats) {
    const kind = STAT_KIND[stat];
    if (kind !== "number") candidates.push({ kind, stats: [stat] });
  }

  const rows: StatRow[] = [];
  const dropped: StatKey[] = [];
  let used = 0;
  for (const row of candidates) {
    const height =
      row.kind === "numbers"
        ? space.number
        : layout === "poster" && row.stats[0] === "top-artist"
          ? POSTER_TOP_ARTIST
          : space[row.kind];
    const needed = (rows.length ? space.gap : layout === "tiles" ? 56 : space.gap) + height;
    if (used + needed <= space.room) {
      rows.push(row);
      used += needed;
    } else {
      dropped.push(...row.stats);
    }
  }
  return { rows, dropped };
}

export const statLabel = (key: StatKey) => STATS.find((stat) => stat.key === key)!.label;
