// Levels from total minutes listened (1 minute = 1 XP). Each level asks a bit
// more than the one before: level 10 is about 5,000 minutes, level 20 about
// 26,000, level 50 (the top) about 210,000.

export const MAX_LEVEL = 50;

export function minutesForLevel(level: number): number {
  return level <= 1 ? 0 : Math.round(40 * (level - 1) ** 2.2);
}

// Career stages, by the first level of each
const TITLES: [number, string][] = [
  [1, "Bedroom listener"],
  [5, "Garage band"],
  [10, "Open mic regular"],
  [15, "Opening act"],
  [20, "Touring act"],
  [27, "Headliner"],
  [34, "Festival headliner"],
  [42, "Icon"],
  [50, "Legend"],
];

export function levelTitle(level: number): string {
  return [...TITLES].reverse().find(([from]) => level >= from)![1];
}

export interface Level {
  level: number;
  title: string;
  minutes: number;
  // Minutes at which this level and the next one start (next is null at the top)
  levelStart: number;
  nextLevelAt: number | null;
  progress: number;
}

export function levelFor(minutes: number): Level {
  let level = 1;
  while (level < MAX_LEVEL && minutes >= minutesForLevel(level + 1)) level++;
  const levelStart = minutesForLevel(level);
  const nextLevelAt = level < MAX_LEVEL ? minutesForLevel(level + 1) : null;
  return {
    level,
    title: levelTitle(level),
    minutes,
    levelStart,
    nextLevelAt,
    progress: nextLevelAt ? (minutes - levelStart) / (nextLevelAt - levelStart) : 1,
  };
}
