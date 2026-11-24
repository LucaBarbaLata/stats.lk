import { sql } from "drizzle-orm";
import { upsertTracks } from "./catalog";
import { db } from "./db";
import { nowPlaying } from "./db/schema";
import { spotifyGet } from "./spotify/api";
import { getAccessToken } from "./spotify/tokens";
import type { SpotifyTrack } from "./spotify/types";

interface CurrentlyPlaying {
  is_playing: boolean;
  progress_ms: number | null;
  currently_playing_type: "track" | "episode" | "ad" | "unknown";
  item: SpotifyTrack | null;
}

// Asks Spotify what the user is playing and stores it. Podcasts, ads and
// local files are stored as "nothing playing".
export async function refreshNowPlaying(userId: string): Promise<void> {
  const token = await getAccessToken(userId);
  const data = await spotifyGet<CurrentlyPlaying>("/me/player/currently-playing", token);
  const track =
    data?.currently_playing_type === "track" && data.item?.id && !data.item.is_local ? data.item : null;
  if (track) await upsertTracks([track]);

  const values = {
    trackId: track?.id ?? null,
    isPlaying: Boolean(track && data?.is_playing),
    progressMs: track ? (data?.progress_ms ?? null) : null,
    fetchedAt: new Date(),
  };
  await db
    .insert(nowPlaying)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: nowPlaying.userId, set: values });
}

// Users whose now playing is too old, for the worker. People who weren't
// listening are asked about less often: this is by far the request we make
// most, and Spotify blocks for hours when there are too many.
export async function staleNowPlayingUsers(playingMaxAgeMs: number, idleMaxAgeMs: number): Promise<string[]> {
  const rows = await db.execute<{ id: string }>(sql`
    select u.id from users u
    join spotify_tokens st on st.user_id = u.id and st.revoked_at is null
    left join now_playing np on np.user_id = u.id
    where np.fetched_at is null or np.fetched_at < now() - make_interval(
      secs => case when np.is_playing then ${playingMaxAgeMs / 1000}::float8 else ${idleMaxAgeMs / 1000}::float8 end)`);
  return rows.map((row) => row.id);
}
