import assert from "node:assert/strict";
import { mock } from "node:test";
import { sql } from "drizzle-orm";
import { client, db } from "@/lib/db";
import { albumArtists, albums, artists, streams, trackArtists, tracks, users } from "@/lib/db/schema";
import type { SpotifyTrack } from "@/lib/spotify/types";

// resetDatabase wipes everything, so never run against anything else
assert.equal(
  new URL(process.env.DATABASE_URL as string).pathname,
  "/statslk_test",
  "Tests only run on the test database. Start them with npm test.",
);

export async function resetDatabase() {
  await db.execute(sql`truncate users, tracks, artists, albums, worker_heartbeat cascade`);
}

export const closeDatabase = () => client.end();

// Answers the app's requests. Spotify's token endpoint is always answered, and
// anything `answer` doesn't handle fails the test instead of reaching the network.
export function stubFetch(answer: (url: string) => Response | undefined = () => undefined) {
  return mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("accounts.spotify.com/api/token")) {
      return Response.json({ access_token: "fake", token_type: "Bearer", expires_in: 3600 });
    }
    const response = answer(url);
    if (!response) throw new Error(`Unexpected request in a test: ${url}`);
    return response;
  });
}

export async function createUser() {
  const [user] = await db
    .insert(users)
    .values({ spotifyId: "test-user", username: "test-user", displayName: "Test user" })
    .returning();
  return user;
}

// A Spotify ID: 22 characters, ending in `id`
export const spotifyId = (id: string) => id.padStart(22, "x");

// A track with its artist already known, as if it came from Spotify
export async function addTrack(id: string, artistId: string, artistName: string, albumId?: string) {
  await db.insert(artists).values({ id: artistId, name: artistName }).onConflictDoNothing();
  if (albumId) {
    await db.insert(albums).values({ id: albumId, name: `Album ${albumId}` }).onConflictDoNothing();
    await db.insert(albumArtists).values({ albumId, artistId, position: 0 }).onConflictDoNothing();
  }
  await db.insert(tracks).values({ id, name: `Track ${id}`, albumId, detailsFetchedAt: new Date() });
  await db.insert(trackArtists).values({ trackId: id, artistId, position: 0 });
}

export async function addPlay(userId: string, trackId: string, playedAt: string, msPlayed = 180_000) {
  await db.insert(streams).values({ userId, trackId, playedAt: new Date(playedAt), msPlayed, source: "import" });
}

export function spotifyTrack(
  id: string,
  artist: { id: string; name: string },
  album: { id: string; name: string; imageUrl?: string },
): SpotifyTrack {
  return {
    id,
    name: `Track ${id}`,
    duration_ms: 180_000,
    explicit: false,
    artists: [artist],
    album: {
      id: album.id,
      name: album.name,
      album_type: "album",
      release_date: "2001-01-01",
      images: album.imageUrl ? [{ url: album.imageUrl, width: 640, height: 640 }] : [],
      artists: [artist],
    },
  } as SpotifyTrack;
}
