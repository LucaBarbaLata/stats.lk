import { addDays, formatDay, startOfWeek } from "./dates";
import type { Range } from "./ranges";

// "This week/month/year so far" against the same stretch of the previous
// one, so a half-finished month isn't compared with a whole one.

export type PeriodKind = "week" | "month" | "year";

export const PERIOD_LABELS: Record<PeriodKind, string> = {
  week: "This week",
  month: "This month",
  year: "This year",
};

const custom = (from: string, to: string): Range => ({
  key: "custom",
  from,
  to,
  label: `${formatDay(from, { year: undefined })} – ${formatDay(to)}`,
});

function lastDayOfMonth(year: number, month: number): string {
  // Day 0 of the next month is the last day of this one
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

export function comparePeriods(
  kind: PeriodKind,
  today: string,
  weekStart = 1,
): { current: Range; previous: Range } {
  const [year, month, day] = today.split("-").map(Number);

  if (kind === "week") {
    const start = startOfWeek(today, weekStart);
    return { current: custom(start, today), previous: custom(addDays(start, -7), addDays(today, -7)) };
  }

  if (kind === "month") {
    const prevYear = month === 1 ? year - 1 : year;
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevStart = `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`;
    const prevEnd = addDays(prevStart, day - 1);
    const prevLast = lastDayOfMonth(prevYear, prevMonth);
    return {
      current: custom(`${today.slice(0, 7)}-01`, today),
      previous: custom(prevStart, prevEnd < prevLast ? prevEnd : prevLast),
    };
  }

  // Feb 29 compares with Feb 28 of the previous year
  const prevSameDay = `${year - 1}-${today.slice(5)}`;
  const prevEnd = month === 2 && day === 29 ? `${year - 1}-02-28` : prevSameDay;
  return { current: custom(`${year}-01-01`, today), previous: custom(`${year - 1}-01-01`, prevEnd) };
}

export function yearRange(year: number): Range {
  return { key: "custom", from: `${year}-01-01`, to: `${year}-12-31`, label: String(year) };
}
