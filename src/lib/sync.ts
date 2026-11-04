import { eq } from "drizzle-orm";
import { upsertTracks } from "./catalog";
import { db } from "./db";
import { streams, users } from "./db/schema";
import { spotifyGet, SpotifyError } from "./spotify/api";
import { getAccessToken } from "./spotify/tokens";
import type { RecentlyPlayed } from "./spotify/types";

// Spotify only exposes the last 50 plays, so this has to run often enough
// that nobody listens to more than 50 tracks between two runs.
async function syncRecentlyPlayed(userId: string): Promise<number> {
  const token = await getAccessToken(userId);
  const data = await spotifyGet<RecentlyPlayed>("/me/player/recently-played?limit=50", token);
  const items = (data?.items ?? []).filter((item) => item.track?.id && !item.track.is_local);

  await upsertTracks(items.map((item) => item.track));

  let added = 0;
  if (items.length) {
    const inserted = await db
      .insert(streams)
      .values(
        items.map((item) => ({
          userId,
          trackId: item.track.id!,
          playedAt: new Date(item.played_at),
          msPlayed: item.track.duration_ms,
          source: "api" as const,
        })),
      )
      .onConflictDoNothing()
      .returning({ id: streams.id });
    added = inserted.length;
  }

  const newest = items.reduce<Date | null>((latest, item) => {
    const playedAt = new Date(item.played_at);
    return !latest || playedAt > latest ? playedAt : latest;
  }, null);
  await db
    .update(users)
    .set({ lastSyncedAt: new Date(), syncError: null, ...(newest && { lastPlayedAt: newest }) })
    .where(eq(users.id, userId));
  return added;
}

// Syncs one user and records failures on the user row. Rate limits are
// rethrown so the caller can back off.
export async function syncUser(userId: string): Promise<number> {
  try {
    return await syncRecentlyPlayed(userId);
  } catch (error) {
    if (error instanceof SpotifyError && error.status === 429) throw error;
    const message = error instanceof Error ? error.message : String(error);
    await db
      .update(users)
      .set({ lastSyncedAt: new Date(), syncError: message })
      .where(eq(users.id, userId));
    console.error(`Sync failed for user ${userId}:`, message);
    return 0;
  }
}
