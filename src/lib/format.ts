const numberFormat = new Intl.NumberFormat("en-US");
const relativeFormat = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

export function formatMinutes(ms: number): string {
  return numberFormat.format(Math.round(ms / 60_000));
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
];

export function formatRelative(date: Date): string {
  const diff = date.getTime() - Date.now();
  for (const [unit, ms] of UNITS) {
    if (Math.abs(diff) >= ms) return relativeFormat.format(Math.round(diff / ms), unit);
  }
  return "just now";
}
