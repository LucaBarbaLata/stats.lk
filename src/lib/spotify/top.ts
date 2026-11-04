import { eq } from "drizzle-orm";
import { upsertArtists, upsertTracks } from "../catalog";
import { db } from "../db";
import { users } from "../db/schema";
import type { SpotifyTerm } from "../ranges";
import { pickImage, spotifyGet } from "./api";
import { getAccessToken } from "./tokens";
import type { SpotifyArtist, SpotifyTrack } from "./types";

export interface SpotifyTopItem {
  id: string;
  name: string;
  imageUrl: string | null;
  subtitle: string;
}

// Spotify's own ranking of the user's top tracks or artists. Used while we
// don't have enough history for a range: it has no play counts or minutes.
// The items are stored so that links to their pages work.
export async function getSpotifyTop(
  userId: string,
  type: "tracks" | "artists",
  term: SpotifyTerm,
): Promise<SpotifyTopItem[]> {
  const token = await getAccessToken(userId);
  const path = `/me/top/${type}?time_range=${term}&limit=50`;

  if (type === "tracks") {
    const data = await spotifyGet<{ items: SpotifyTrack[] }>(path, token);
    const items = (data?.items ?? []).filter((track) => track.id && !track.is_local);
    await upsertTracks(items);
    return items.map((track) => ({
      id: track.id!,
      name: track.name,
      imageUrl: pickImage(track.album.images, 64),
      subtitle: track.artists.map((artist) => artist.name).join(", "),
    }));
  }

  const data = await spotifyGet<{ items: SpotifyArtist[] }>(path, token);
  const items = data?.items ?? [];
  await upsertArtists(items);
  return items.map((artist) => ({
    id: artist.id,
    name: artist.name,
    imageUrl: pickImage(artist.images, 64),
    subtitle: "",
  }));
}

const TERMS: SpotifyTerm[] = ["short_term", "medium_term", "long_term"];

// Top lists are the only full artists a user's token can read, so this is how
// the artists people play most get Spotify's own photo and ID right away. They
// kept working while Spotify blocked catalog lookups for a day. Only an extra:
// if they fail, syncing carries on and they're tried again next time.
export async function refreshTopLists(userId: string): Promise<void> {
  try {
    for (const term of TERMS) {
      await getSpotifyTop(userId, "artists", term);
      await getSpotifyTop(userId, "tracks", term);
    }
  } catch (error) {
    console.error(`Top lists failed for user ${userId}:`, error instanceof Error ? error.message : error);
  }
  await db.update(users).set({ topListsFetchedAt: new Date() }).where(eq(users.id, userId));
}
