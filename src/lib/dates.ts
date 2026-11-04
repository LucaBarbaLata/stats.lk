// Helpers for calendar days written as "YYYY-MM-DD" (local days in the app
// timezone, as returned by the stats queries). Arithmetic is done in UTC so
// it never shifts with the server's own timezone.

import { appTimezone } from "./env";

const DAY_MS = 24 * 60 * 60 * 1000;

export function today(): string {
  // en-CA formats dates as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: appTimezone() }).format(new Date());
}

const toUtc = (day: string) => Date.parse(`${day}T00:00:00Z`);
const fromUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function addDays(day: string, days: number): string {
  return fromUtc(toUtc(day) + days * DAY_MS);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}

// 1 = Monday ... 7 = Sunday
export function isoWeekday(day: string): number {
  return ((new Date(toUtc(day)).getUTCDay() + 6) % 7) + 1;
}

// First day of the week `day` is in; weekStart is an ISO weekday (1 = Monday, 7 = Sunday)
export function startOfWeek(day: string, weekStart = 1): string {
  return addDays(day, -((isoWeekday(day) - weekStart + 7) % 7));
}

export function formatDay(day: string, options: Intl.DateTimeFormatOptions = {}): string {
  return new Date(toUtc(day)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
    ...options,
  });
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: appTimezone(),
  });
}

export interface Streaks {
  current: number;
  longest: { length: number; start: string; end: string } | null;
}

// `days` must be sorted, oldest first. The current streak still counts if
// the last listening day was yesterday (today isn't over yet).
export function computeStreaks(days: string[], todayDay: string): Streaks {
  let longest: Streaks["longest"] = null;
  let runStart = days[0];
  let runLength = 0;
  for (let i = 0; i < days.length; i++) {
    runLength = i > 0 && daysBetween(days[i - 1], days[i]) === 1 ? runLength + 1 : 1;
    if (runLength === 1) runStart = days[i];
    if (!longest || runLength > longest.length) {
      longest = { length: runLength, start: runStart, end: days[i] };
    }
  }
  const last = days.at(-1);
  const current = last && daysBetween(last, todayDay) <= 1 ? runLength : 0;
  return { current, longest };
}
