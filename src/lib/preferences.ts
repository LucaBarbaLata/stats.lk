import { cache } from "react";

// The logged-in user's time zone for the current request. React's cache()
// gives every server request its own object, filled in when the session is
// read (src/lib/session.ts). Outside a request, as in the worker, each call
// returns a fresh object, so the app default applies.
export const requestPreferences = cache((): { timezone: string | null } => ({ timezone: null }));

let timeZones: Set<string> | null = null;

export function isValidTimezone(value: string): boolean {
  timeZones ??= new Set(Intl.supportedValuesOf("timeZone"));
  return timeZones.has(value);
}

export const WEEK_STARTS = [
  { value: 1, label: "Monday" },
  { value: 7, label: "Sunday" },
] as const;

export const SORTS = [
  { value: "plays", label: "By plays" },
  { value: "minutes", label: "By minutes" },
] as const;
