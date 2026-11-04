import { requestPreferences } from "./preferences";

// Read lazily so that `next build` works without secrets present.
export function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

export function appUrl(): string {
  return env("APP_URL").replace(/\/$/, "");
}

export function spotifyRedirectUri(): string {
  return `${appUrl()}/api/auth/callback`;
}

// Shown on the privacy and terms pages; optional
export function contactEmail(): string | null {
  return process.env.CONTACT_EMAIL || null;
}

// Spotify user IDs allowed to open /admin
export function isAdmin(spotifyId: string): boolean {
  return (process.env.ADMIN_SPOTIFY_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .includes(spotifyId);
}

// Day boundaries ("minutes today", heatmap days): the user's own time zone
// when one is set, else the app default
export function appTimezone(): string {
  return requestPreferences().timezone ?? process.env.APP_TIMEZONE ?? "Europe/Bucharest";
}

export function syncIntervalMs(): number {
  const minutes = Number(process.env.SYNC_INTERVAL_MINUTES ?? 3);
  return Math.max(1, minutes) * 60_000;
}
