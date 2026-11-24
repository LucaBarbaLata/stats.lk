import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { deleteUnconfirmedAccounts } from "@/lib/accounts";
import { fetchMissingCatalogDetails, fetchMissingGenres } from "@/lib/catalog";
import { db } from "@/lib/db";
import { nowPlaying, spotifyTokens, users, workerHeartbeat } from "@/lib/db/schema";
import { syncIntervalMs } from "@/lib/env";
import { checkDueImports } from "@/lib/import/check";
import { linkImportedTracks } from "@/lib/import/link";
import { refreshNowPlaying, staleNowPlayingUsers } from "@/lib/now-playing";
import { fetchMissingPictures } from "@/lib/pictures";
import { SpotifyError } from "@/lib/spotify/api";
import { pausedUntil, type SpotifyCall } from "@/lib/spotify/pauses";
import { sendDueReminders } from "@/lib/reminders";
import { refreshTopLists } from "@/lib/spotify/top";
import { syncUser } from "@/lib/sync";
import { SyncSchedule } from "@/lib/sync-schedule";

const TICK_MS = 15_000;
// How fresh "now playing" is kept while someone listens, and while they don't.
// A paused track disappears 2 minutes after it was last seen (getNowPlaying in
// src/lib/social.ts), so idle has to stay under that.
const PLAYING_MAX_AGE_MS = 30_000;
const IDLE_MAX_AGE_MS = 90_000;
// Spotify blocks catalog lookups for a day once too many are made, so they're
// spread out: this is about 480 a day, under the 650 that got blocked
const CATALOG_ROUND_MS = 15 * 60_000;
const CATALOG_LOOKUPS_PER_ROUND = 5;
// Top lists change slowly, and six requests per user bring in up to 300 items
const TOP_LISTS_EVERY_MS = 6 * 60 * 60_000;
// Last.fm allows about 5 requests per second
const GENRES_PER_TICK = 40;
// Deezer allows about 10 requests per second, and an artist can take three
const PICTURES_PER_TICK = 40;
// Sign-ups nobody confirmed are removed after a day, import reminders go out
// once a month and imports are checked once a day; hourly is enough for all
const CLEANUP_EVERY_MS = 60 * 60_000;
const IMPORT_CHECKS_PER_ROUND = 5;

let busy = false;
let stopping = false;
let nextCatalogRound = 0;
let nextCleanup = 0;
const schedule = new SyncSchedule(syncIntervalMs());

function stop() {
  stopping = true;
  if (!busy) process.exit(0);
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Users with working tokens who may have new plays, longest-waiting first.
async function dueUsers() {
  schedule.watch(await db.select({ userId: nowPlaying.userId, trackId: nowPlaying.trackId }).from(nowPlaying));
  const connected = await db
    .select({ id: users.id, displayName: users.displayName, lastSyncedAt: users.lastSyncedAt })
    .from(users)
    .innerJoin(spotifyTokens, eq(spotifyTokens.userId, users.id))
    .where(isNull(spotifyTokens.revokedAt))
    .orderBy(sql`${users.lastSyncedAt} asc nulls first`);
  return connected.filter((user) => schedule.isDue(user));
}

// Users with working tokens whose top lists are old or were never stored.
function usersDueForTopLists() {
  const cutoff = new Date(Date.now() - TOP_LISTS_EVERY_MS);
  return db
    .select({ id: users.id })
    .from(users)
    .innerJoin(spotifyTokens, eq(spotifyTokens.userId, users.id))
    .where(
      and(
        isNull(spotifyTokens.revokedAt),
        or(isNull(users.topListsFetchedAt), lt(users.topListsFetchedAt, cutoff)),
      ),
    );
}

// Whether Spotify refused this kind of request, so the rest of them wait while
// everything else carries on. The login server's refusals don't pause anything
// and go up to main, which waits a bit.
async function isPaused(error: unknown, call: SpotifyCall): Promise<boolean> {
  return error instanceof SpotifyError && error.status === 429 && Boolean(await pausedUntil(call));
}

async function tick() {
  const now = new Date();
  await db
    .insert(workerHeartbeat)
    .values({ id: 1, beatAt: now })
    .onConflictDoUpdate({ target: workerHeartbeat.id, set: { beatAt: now } });

  for (const userId of await staleNowPlayingUsers(PLAYING_MAX_AGE_MS, IDLE_MAX_AGE_MS)) {
    if (stopping) return;
    if (await pausedUntil("now-playing")) break;
    try {
      await refreshNowPlaying(userId);
    } catch (error) {
      if (await isPaused(error, "now-playing")) break;
      if (error instanceof SpotifyError && error.status === 429) throw error;
      console.error(`Now playing failed for user ${userId}:`, error instanceof Error ? error.message : error);
    }
  }
  for (const user of await dueUsers()) {
    if (stopping) return;
    if (await pausedUntil("recently-played")) break;
    try {
      const added = await syncUser(user.id);
      if (added) console.log(`${user.displayName}: ${added} new plays`);
    } catch (error) {
      if (await isPaused(error, "recently-played")) break;
      throw error;
    }
  }
  for (const user of await usersDueForTopLists()) {
    if (stopping) return;
    if (await pausedUntil("top-lists")) break;
    await refreshTopLists(user.id);
  }
  if (Date.now() >= nextCleanup) {
    nextCleanup = Date.now() + CLEANUP_EVERY_MS;
    const deleted = await deleteUnconfirmedAccounts();
    if (deleted) console.log(`Deleted ${deleted} sign-ups that were never confirmed`);
    const reminded = await sendDueReminders();
    if (reminded) console.log(`Sent ${reminded} import reminders`);
    const checked = await checkDueImports(IMPORT_CHECKS_PER_ROUND);
    if (checked) console.log(`Checked the imports of ${checked} users`);
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
  console.log(`Worker started, syncing when tracks end, at most every ${syncIntervalMs() / 60_000} min`);
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
