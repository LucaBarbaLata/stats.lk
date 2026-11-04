import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { fetchMissingCatalogDetails, fetchMissingGenres } from "@/lib/catalog";
import { db } from "@/lib/db";
import { spotifyTokens, users, workerHeartbeat } from "@/lib/db/schema";
import { syncIntervalMs } from "@/lib/env";
import { linkImportedTracks } from "@/lib/import/link";
import { refreshNowPlaying, staleNowPlayingUsers } from "@/lib/now-playing";
import { fetchMissingPictures } from "@/lib/pictures";
import { SpotifyError } from "@/lib/spotify/api";
import { syncUser } from "@/lib/sync";

const TICK_MS = 15_000;
// How fresh "now playing" is kept for every user
const NOW_PLAYING_MAX_AGE_MS = 30_000;
// Spotify blocks catalog lookups for a day once too many are made, so they're
// spread out: this is about 480 a day, under the 650 that got blocked
const CATALOG_ROUND_MS = 15 * 60_000;
const CATALOG_LOOKUPS_PER_ROUND = 5;
// Last.fm allows about 5 requests per second
const GENRES_PER_TICK = 40;
// Deezer allows about 10 requests per second
const PICTURES_PER_TICK = 60;

let busy = false;
let stopping = false;
let nextCatalogRound = 0;

function stop() {
  stopping = true;
  if (!busy) process.exit(0);
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Users with working tokens whose last sync is older than the interval,
// longest-waiting first.
function dueUsers() {
  const cutoff = new Date(Date.now() - syncIntervalMs());
  return db
    .select({ id: users.id, displayName: users.displayName })
    .from(users)
    .innerJoin(spotifyTokens, eq(spotifyTokens.userId, users.id))
    .where(
      and(
        isNull(spotifyTokens.revokedAt),
        or(isNull(users.lastSyncedAt), lt(users.lastSyncedAt, cutoff)),
      ),
    )
    .orderBy(sql`${users.lastSyncedAt} asc nulls first`);
}

async function tick() {
  const now = new Date();
  await db
    .insert(workerHeartbeat)
    .values({ id: 1, beatAt: now })
    .onConflictDoUpdate({ target: workerHeartbeat.id, set: { beatAt: now } });

  for (const userId of await staleNowPlayingUsers(NOW_PLAYING_MAX_AGE_MS)) {
    if (stopping) return;
    try {
      await refreshNowPlaying(userId);
    } catch (error) {
      if (error instanceof SpotifyError && error.status === 429) throw error;
      console.error(`Now playing failed for user ${userId}:`, error instanceof Error ? error.message : error);
    }
  }
  for (const user of await dueUsers()) {
    if (stopping) return;
    const added = await syncUser(user.id);
    if (added) console.log(`${user.displayName}: ${added} new plays`);
  }
  if (Date.now() >= nextCatalogRound) {
    nextCatalogRound = Date.now() + CATALOG_ROUND_MS;
    const fetched = await fetchMissingCatalogDetails(CATALOG_LOOKUPS_PER_ROUND);
    if (fetched.tracks) console.log(`Fetched details for ${fetched.tracks} imported tracks`);
    if (fetched.artists) console.log(`Fetched details for ${fetched.artists} artists`);
  }
  // Last.fm or Deezer problems (bad key, outage) only cost us extras, not syncing
  try {
    const fetchedGenres = await fetchMissingGenres(GENRES_PER_TICK);
    if (fetchedGenres) console.log(`Fetched genres for ${fetchedGenres} artists`);
    const fetchedPictures = await fetchMissingPictures(PICTURES_PER_TICK);
    if (fetchedPictures) console.log(`Looked up pictures for ${fetchedPictures} artists and albums`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
  }
}

async function main() {
  console.log(`Worker started, syncing every ${syncIntervalMs() / 60_000} min`);
  if (!process.env.LASTFM_API_KEY) console.log("LASTFM_API_KEY not set, skipping genres");
  // Imports link their tracks as they're saved; this catches any left behind
  await linkImportedTracks();
  while (!stopping) {
    busy = true;
    try {
      await tick();
    } catch (error) {
      if (error instanceof SpotifyError && error.status === 429) {
        const seconds = error.retryAfterSeconds ?? 30;
        console.warn(`${error.message}, pausing for ${seconds}s`);
        busy = false;
        await sleep(seconds * 1000);
        continue;
      }
      console.error("Worker tick failed:", error);
    }
    busy = false;
    if (stopping) break;
    await sleep(TICK_MS);
  }
  process.exit(0);
}

main();
