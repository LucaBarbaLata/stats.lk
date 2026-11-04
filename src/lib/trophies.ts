import type { TrophyMetrics } from "./trophy-metrics";

// The trophy catalog. Each trophy reads one metric and has up to three tiers
// (bronze, silver, gold); a single threshold means a one-off trophy.

export type TrophyCategory = "habits" | "discovery" | "loyalty" | "social";

export const CATEGORIES: { key: TrophyCategory; label: string; description: string }[] = [
  { key: "habits", label: "Habits and volume", description: "How much and when you listen." },
  { key: "discovery", label: "Discovery and eras", description: "New artists, genres, and music old and new." },
  { key: "loyalty", label: "Loyalty and albums", description: "The artists, tracks and albums you keep coming back to." },
  { key: "social", label: "Social", description: "Friends, shared taste and bragging rights." },
];

export type TrophyIcon =
  | "moon"
  | "sunrise"
  | "calendar"
  | "timer"
  | "headphones"
  | "flame"
  | "compass"
  | "shapes"
  | "hourglass"
  | "sparkles"
  | "library"
  | "heart"
  | "repeat"
  | "star"
  | "disc"
  | "layers"
  | "users"
  | "handshake"
  | "crown"
  | "history";

export interface TrophyDefinition {
  key: string;
  name: string;
  category: TrophyCategory;
  icon: TrophyIcon;
  metric: keyof TrophyMetrics;
  tiers: number[];
  // "{n}" is replaced by the threshold of the next tier to reach
  goal: string;
  unit: string;
}

export const TROPHIES: TrophyDefinition[] = [
  // Habits and volume
  { key: "night-owl", name: "Night owl", category: "habits", icon: "moon", metric: "nightPlays", tiers: [25, 100, 500], goal: "Play {n} tracks between midnight and 5 am", unit: "plays" },
  { key: "early-bird", name: "Early bird", category: "habits", icon: "sunrise", metric: "earlyPlays", tiers: [25, 100, 500], goal: "Play {n} tracks between 5 and 8 am", unit: "plays" },
  { key: "weekend-warrior", name: "Weekend warrior", category: "habits", icon: "calendar", metric: "weekendMinutes", tiers: [1000, 5000, 20000], goal: "Listen {n} minutes on weekends", unit: "min" },
  { key: "marathon", name: "Marathon", category: "habits", icon: "timer", metric: "bestDayMinutes", tiers: [240, 480, 720], goal: "Listen {n} minutes in a single day", unit: "min" },
  { key: "dedicated", name: "Dedicated", category: "habits", icon: "headphones", metric: "totalMinutes", tiers: [1000, 10000, 100000], goal: "Listen {n} minutes in total", unit: "min" },
  { key: "daily-habit", name: "Daily habit", category: "habits", icon: "flame", metric: "longestStreak", tiers: [7, 30, 100], goal: "Listen {n} days in a row", unit: "days" },
  // Discovery and eras
  { key: "explorer", name: "Explorer", category: "discovery", icon: "compass", metric: "bestMonthNewArtists", tiers: [10, 25, 50], goal: "Find {n} new artists in one month", unit: "artists" },
  { key: "genre-hopper", name: "Genre hopper", category: "discovery", icon: "shapes", metric: "genres", tiers: [5, 15, 30], goal: "Listen to {n} different genres", unit: "genres" },
  { key: "time-traveller", name: "Time traveller", category: "discovery", icon: "hourglass", metric: "oldTrackPlays", tiers: [10, 50, 200], goal: "Play {n} tracks released before 1980", unit: "plays" },
  { key: "fresh-ears", name: "Fresh ears", category: "discovery", icon: "sparkles", metric: "freshPlays", tiers: [5, 25, 100], goal: "Play {n} tracks in the week they came out", unit: "plays" },
  { key: "collector", name: "Collector", category: "discovery", icon: "library", metric: "artists", tiers: [50, 250, 1000], goal: "Listen to {n} different artists", unit: "artists" },
  // Loyalty and albums
  { key: "loyal-fan", name: "Loyal fan", category: "loyalty", icon: "heart", metric: "longestArtistRun", tiers: [7, 14, 30], goal: "Play the same artist {n} days in a row", unit: "days" },
  { key: "on-repeat", name: "On repeat", category: "loyalty", icon: "repeat", metric: "bestTrackDay", tiers: [5, 10, 20], goal: "Play one track {n} times in a day", unit: "plays" },
  { key: "superfan", name: "Superfan", category: "loyalty", icon: "star", metric: "topArtistPlays", tiers: [100, 500, 1000], goal: "Play one artist {n} times", unit: "plays" },
  { key: "album-diver", name: "Album diver", category: "loyalty", icon: "disc", metric: "bestAlbumDepth", tiers: [5, 8, 12], goal: "Play {n} different tracks from one album", unit: "tracks" },
  { key: "deep-cuts", name: "Deep cuts", category: "loyalty", icon: "layers", metric: "bestArtistDepth", tiers: [10, 25, 50], goal: "Play {n} different tracks by one artist", unit: "tracks" },
  // Social
  { key: "social-butterfly", name: "Social butterfly", category: "social", icon: "users", metric: "friends", tiers: [1, 2, 4], goal: "Have {n} friends on stats.lk", unit: "friends" },
  { key: "taste-twin", name: "Taste twin", category: "social", icon: "handshake", metric: "bestTasteMatch", tiers: [60, 70, 80], goal: "Reach a {n}% taste match with a friend", unit: "%" },
  { key: "top-listener", name: "Top listener", category: "social", icon: "crown", metric: "artistsLed", tiers: [1, 5, 20], goal: "Be the top listener of {n} artists among your friends", unit: "artists" },
  { key: "historian", name: "Historian", category: "social", icon: "history", metric: "imported", tiers: [1], goal: "Import your full Spotify history", unit: "" },
];

export const TIER_NAMES = ["Bronze", "Silver", "Gold"] as const;

export interface TrophyResult extends TrophyDefinition {
  value: number;
  // 0 = locked; 1-3 = bronze, silver, gold (a one-tier trophy unlocks at 3)
  tier: number;
  nextThreshold: number | null;
  progress: number;
}

export function evaluateTrophies(metrics: TrophyMetrics): TrophyResult[] {
  return TROPHIES.map((trophy) => {
    const value = metrics[trophy.metric];
    const reached = trophy.tiers.filter((threshold) => value >= threshold).length;
    const tier = trophy.tiers.length === 1 ? (reached ? 3 : 0) : reached;
    const nextThreshold = trophy.tiers[reached] ?? null;
    const previous = reached ? trophy.tiers[reached - 1] : 0;
    return {
      ...trophy,
      value,
      tier,
      nextThreshold,
      progress: nextThreshold === null ? 1 : Math.max(0, Math.min(1, (value - previous) / (nextThreshold - previous))),
    };
  });
}
