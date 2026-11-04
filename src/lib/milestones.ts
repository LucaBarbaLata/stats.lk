import { addDays } from "./dates";

// Lifetime milestones, worked out from per-day totals. Each kind has a
// ladder of thresholds; reached ones get the day they were reached.

export const LADDERS = {
  minutes: [1_000, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000],
  plays: [100, 500, 1_000, 5_000, 10_000, 25_000, 50_000, 100_000],
  artists: [10, 50, 100, 250, 500, 1_000, 2_500],
  streak: [7, 30, 100, 365],
};
export const ARTIST_PLAYS = [100, 500, 1_000, 2_500];
export const TRACK_PLAYS = [25, 50, 100, 250, 500];

export type LadderKind = keyof typeof LADDERS;

export interface Ladder {
  kind: LadderKind;
  current: number;
  reached: { threshold: number; day: string }[];
  // Next threshold to reach, null when the ladder is complete
  next: number | null;
}

// `points` are per-day amounts, oldest first; the running total is checked
// against the ladder.
function cumulative(kind: LadderKind, points: { day: string; amount: number }[]): Ladder {
  const thresholds = LADDERS[kind];
  const reached: Ladder["reached"] = [];
  let total = 0;
  for (const point of points) {
    total += point.amount;
    while (reached.length < thresholds.length && total >= thresholds[reached.length]) {
      reached.push({ threshold: thresholds[reached.length], day: point.day });
    }
  }
  return { kind, current: total, reached, next: thresholds[reached.length] ?? null };
}

export function minutesLadder(days: { key: string; msPlayed: number }[]): Ladder {
  return cumulative("minutes", days.map((d) => ({ day: d.key, amount: d.msPlayed / 60_000 })));
}

export function playsLadder(days: { key: string; streams: number }[]): Ladder {
  return cumulative("plays", days.map((d) => ({ day: d.key, amount: d.streams })));
}

export function artistsLadder(discoveries: { day: string; artists: number }[]): Ladder {
  return cumulative("artists", discoveries.map((d) => ({ day: d.day, amount: d.artists })));
}

// Streaks: a threshold is reached on the N-th day of the first run that long.
// `current` is the longest streak so far.
export function streakLadder(listeningDays: string[]): Ladder {
  const thresholds = LADDERS.streak;
  const reached: Ladder["reached"] = [];
  let longest = 0;
  let runStart = listeningDays[0];
  let runLength = 0;
  for (let i = 0; i < listeningDays.length; i++) {
    const continues = i > 0 && addDays(listeningDays[i - 1], 1) === listeningDays[i];
    runLength = continues ? runLength + 1 : 1;
    if (runLength === 1) runStart = listeningDays[i];
    longest = Math.max(longest, runLength);
    while (reached.length < thresholds.length && runLength >= thresholds[reached.length]) {
      reached.push({ threshold: thresholds[reached.length], day: addDays(runStart, thresholds[reached.length] - 1) });
    }
  }
  return { kind: "streak", current: longest, reached, next: thresholds[reached.length] ?? null };
}
