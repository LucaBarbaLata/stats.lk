import { computeStreaks, formatDay, today } from "../dates";
import { formatMinutes, formatNumber } from "../format";
import { levelFor } from "../levels";
import { yearRange } from "../periods";
import { PRESETS, type Range } from "../ranges";
import {
  getActivity,
  getDailyTotals,
  getPeriodTotals,
  getTopAlbums,
  getTopArtists,
  getTopGenres,
  getTopTracks,
  type TopItem,
} from "../stats";
import { evaluateTrophies } from "../trophies";
import { getTrophyMetrics } from "../trophy-metrics";
import {
  isRanking,
  planStats,
  RANKING_LAYOUTS,
  WRAPPED_STATS,
  type ShareConfig,
  type ShareData,
  type ShareItem,
  type StatKey,
  type StatValue,
  type SummaryLayout,
} from "./options";
import { THEMES } from "./themes";

// Loads what a share card shows. Artists and tracks the user hid from others
// are left out; totals still count them, as they reveal nothing.

const publicOnly = { publicOnly: true };

const RANGE_LABELS: Record<string, string> = {
  "4w": "Last 4 weeks",
  "6m": "Last 6 months",
  "1y": "Last year",
  all: "All time",
};

const RANKING_TITLES = { "top-artists": "My top artists", "top-tracks": "My top tracks", "top-albums": "My top albums" };

const presetRange = (key: string): Range => ({ ...(PRESETS.find((preset) => preset.key === key) ?? PRESETS[0]) });

const minutesItem = (item: TopItem): ShareItem => ({ ...item, subtitle: `${formatMinutes(item.msPlayed)} minutes` });
const plainItem = ({ id, name, imageUrl, subtitle }: TopItem): ShareItem => ({ id, name, imageUrl, subtitle });

export async function loadShareData(userId: string, config: ShareConfig): Promise<ShareData> {
  if (isRanking(config.card)) {
    const limit = RANKING_LAYOUTS.find((layout) => layout.key === config.layout)?.items ?? 5;
    const range = presetRange(config.range);
    const items =
      config.card === "top-artists"
        ? (await getTopArtists(userId, range, "minutes", limit, publicOnly)).map(minutesItem)
        : config.card === "top-tracks"
          ? (await getTopTracks(userId, range, "plays", limit, publicOnly)).map(plainItem)
          : (await getTopAlbums(userId, range, "plays", limit, publicOnly)).map(plainItem);
    return {
      kind: "ranking",
      title: RANKING_TITLES[config.card],
      subtitle: RANGE_LABELS[range.key],
      items,
      round: config.card === "top-artists",
    };
  }

  const wrapped = config.card === "wrapped";
  const range = wrapped ? yearRange(config.year) : /^\d{4}$/.test(config.period) ? yearRange(Number(config.period)) : presetRange(config.period);
  const wanted = wrapped ? WRAPPED_STATS : config.stats;
  // Only load what fits on the card
  const stats = planStats(config.layout as SummaryLayout, wanted).rows.flatMap((row) => row.stats);
  const needs = (...keys: StatKey[]) => keys.some((key) => stats.includes(key));
  const needsPicture = config.layout === "poster" || THEMES[config.theme].backdrop === true;

  const [totals, artists, tracks, albums, genres, daily, hours, metrics] = await Promise.all([
    wrapped || needs("minutes", "plays", "artists", "tracks") ? getPeriodTotals(userId, range) : null,
    needsPicture || needs("top-artist", "artists-list") ? getTopArtists(userId, range, "minutes", 5, publicOnly) : [],
    needs("top-track", "tracks-list") ? getTopTracks(userId, range, "plays", 5, publicOnly) : [],
    needs("top-album") ? getTopAlbums(userId, range, "plays", 1, publicOnly) : [],
    needs("top-genre") ? getTopGenres(userId, range, "minutes", 1, publicOnly) : [],
    needs("streak", "busiest-day") ? getDailyTotals(userId, range) : [],
    needs("peak-hour") ? getActivity(userId, "hour", range) : [],
    needs("level", "trophies") ? getTrophyMetrics(userId) : null,
  ]);

  const values: Partial<Record<StatKey, StatValue>> = {};
  const number = (key: StatKey, value: string, label: string) => {
    values[key] = { kind: "number", value, label };
  };

  if (totals) {
    number("minutes", formatMinutes(totals.msPlayed), "minutes listened");
    number("plays", formatNumber(totals.streams), totals.streams === 1 ? "play" : "plays");
    number("artists", formatNumber(totals.artists), totals.artists === 1 ? "artist" : "artists");
    number("tracks", formatNumber(totals.tracks), totals.tracks === 1 ? "different track" : "different tracks");
  }
  number("top-genre", genres[0]?.name ?? "–", "top genre");
  if (needs("streak")) {
    const longest = computeStreaks(daily.map((day) => day.key), today()).longest?.length ?? 0;
    number("streak", formatNumber(longest), longest === 1 ? "day in a row" : "days in a row");
  }
  if (needs("busiest-day")) {
    const best = daily.reduce<(typeof daily)[number] | null>((top, day) => (!top || day.msPlayed > top.msPlayed ? day : top), null);
    number("busiest-day", best ? formatMinutes(best.msPlayed) : "–", best ? `minutes on ${formatDay(best.key)}` : "minutes in a day");
  }
  if (needs("peak-hour")) {
    const peak = hours.reduce<(typeof hours)[number] | null>((top, hour) => (!top || hour.msPlayed > top.msPlayed ? hour : top), null);
    number("peak-hour", peak ? `${peak.key.padStart(2, "0")}:00` : "–", "favourite hour");
  }
  if (metrics) {
    const level = levelFor(metrics.totalMinutes);
    number("level", String(level.level), `level · ${level.title}`);
    const trophies = evaluateTrophies(metrics);
    number("trophies", String(trophies.filter((trophy) => trophy.tier > 0).length), `of ${trophies.length} trophies`);
  }

  values["top-artist"] = { kind: "feature", label: "Top artist", item: artists[0] ? minutesItem(artists[0]) : null, round: true };
  values["top-track"] = { kind: "feature", label: "Top track", item: tracks[0] ? plainItem(tracks[0]) : null };
  values["top-album"] = { kind: "feature", label: "Top album", item: albums[0] ? plainItem(albums[0]) : null };
  values["artists-list"] = { kind: "list", label: "Top artists", items: artists.map(minutesItem), round: true };
  values["tracks-list"] = { kind: "list", label: "Top tracks", items: tracks.map(plainItem) };

  return {
    kind: "summary",
    title: wrapped ? `My ${config.year} Wrapped` : config.title,
    subtitle: wrapped
      ? `${formatNumber(totals?.streams ?? 0)} plays`
      : range.key === "custom"
        ? range.label
        : RANGE_LABELS[range.key],
    stats: wanted,
    values,
    picture: artists[0]?.imageUrl ?? tracks[0]?.imageUrl ?? albums[0]?.imageUrl ?? null,
  };
}
