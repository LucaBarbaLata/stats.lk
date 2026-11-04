import type { Bucket } from "./stats";

// Chart-ready series from activity buckets, with empty slots filled in.

export interface ChartPoint {
  label: string;
  fullLabel: string;
  minutes: number;
  plays: number;
}

function fill(buckets: Bucket[], keys: string[], label: (key: string) => [string, string]): ChartPoint[] {
  const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));
  return keys.map((key) => {
    const bucket = byKey.get(key);
    const [short, full] = label(key);
    return {
      label: short,
      fullLabel: full,
      minutes: Math.round((bucket?.msPlayed ?? 0) / 60_000),
      plays: bucket?.streams ?? 0,
    };
  });
}

export function hourSeries(buckets: Bucket[]): ChartPoint[] {
  const keys = Array.from({ length: 24 }, (_, hour) => String(hour));
  return fill(buckets, keys, (key) => {
    const hour = key.padStart(2, "0");
    return [hour, `${hour}:00–${String((Number(key) + 1) % 24).padStart(2, "0")}:00`];
  });
}

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// ISO weekdays (1 = Monday .. 7 = Sunday) in the order the user's week runs
export function weekdayOrder(weekStart = 1): number[] {
  return Array.from({ length: 7 }, (_, index) => ((weekStart - 1 + index) % 7) + 1);
}

export function weekdaySeries(buckets: Bucket[], weekStart = 1): ChartPoint[] {
  const keys = weekdayOrder(weekStart).map(String);
  return fill(buckets, keys, (key) => {
    const name = WEEKDAYS[Number(key) - 1];
    return [name.slice(0, 3), name];
  });
}

// Every month from the first bucket (or `from`) to `to`, as "YYYY-MM".
export function monthSeries(buckets: Bucket[], to: string, from?: string): ChartPoint[] {
  const start = from ?? buckets[0]?.key ?? to;
  const keys: string[] = [];
  let [year, month] = start.split("-").map(Number);
  const [endYear, endMonth] = to.split("-").map(Number);
  while (year < endYear || (year === endYear && month <= endMonth)) {
    keys.push(`${year}-${String(month).padStart(2, "0")}`);
    month = month === 12 ? 1 : month + 1;
    if (month === 1) year++;
  }
  return fill(buckets, keys, (key) => {
    const date = new Date(`${key}-01T00:00:00Z`);
    const monthName = date.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
    // Show the year on January and on the first column
    const short = key.endsWith("-01") || key === keys[0] ? `${monthName} ${key.slice(2, 4)}` : monthName;
    return [short, date.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })];
  });
}

// Parts of the day, coloured the same everywhere (validated for colour blindness)
export const DAYPARTS = [
  { label: "Night", from: 0, color: "#7f73f0" },
  { label: "Morning", from: 6, color: "#c27d0e" },
  { label: "Afternoon", from: 12, color: "#1597d6" },
  { label: "Evening", from: 18, color: "#e05f86" },
] as const;

export const WEEKEND_COLOR = "#e05f86";

export function daypartOf(hour: number) {
  return [...DAYPARTS].reverse().find((part) => hour >= part.from)!;
}

const sumMinutes = (points: ChartPoint[]) => points.reduce((sum, point) => sum + point.minutes, 0);

export function peakOf(points: ChartPoint[]): ChartPoint | null {
  const peak = points.reduce<ChartPoint | null>((best, point) => (!best || point.minutes > best.minutes ? point : best), null);
  return peak && peak.minutes > 0 ? peak : null;
}

// Share of all minutes, 0-100, for points matching `match`
export function shareOf(points: ChartPoint[], match: (point: ChartPoint, index: number) => boolean): number {
  const total = sumMinutes(points);
  if (!total) return 0;
  return Math.round((sumMinutes(points.filter(match)) / total) * 100);
}
