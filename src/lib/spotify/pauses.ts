import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "../db";
import { spotifyPauses } from "../db/schema";

// Spotify limits requests per group of endpoints and doesn't publish the
// groups (a block on catalog lookups left syncing alone, in November 2026), so
// each kind of request waits on its own. Pauses are stored, so the web app and
// the worker share them and a restart doesn't ask again too early.
export type SpotifyCall = "now-playing" | "recently-played" | "top-lists" | "catalog";

const PATHS: [prefix: string, call: SpotifyCall][] = [
  ["/me/player/currently-playing", "now-playing"],
  ["/me/player/recently-played", "recently-played"],
  ["/me/top/", "top-lists"],
  ["/tracks/", "catalog"],
  ["/artists/", "catalog"],
];

// Null for requests that are always tried, like reading the profile at login
export function callOf(path: string): SpotifyCall | null {
  return PATHS.find(([prefix]) => path.startsWith(prefix))?.[1] ?? null;
}

// now() in SQL, because pages call these too and reading the clock in JS can
// break prerendering
const isActive = gt(spotifyPauses.until, sql`now()`);

// When Spotify can be asked again, or null when it can be asked now
export async function pausedUntil(call: SpotifyCall): Promise<Date | null> {
  const [row] = await db
    .select({ until: spotifyPauses.until })
    .from(spotifyPauses)
    .where(and(eq(spotifyPauses.call, call), isActive));
  return row?.until ?? null;
}

// The web app and the worker can be refused at the same time; the longer wait wins
export async function pauseCall(call: SpotifyCall, seconds: number, reason: string): Promise<void> {
  const until = new Date(Date.now() + seconds * 1000);
  await db
    .insert(spotifyPauses)
    .values({ call, until, reason })
    .onConflictDoUpdate({
      target: spotifyPauses.call,
      set: { until: sql`greatest(${spotifyPauses.until}, excluded.until)`, reason },
    });
}

export function activePauses() {
  return db.select().from(spotifyPauses).where(isActive).orderBy(spotifyPauses.call);
}
