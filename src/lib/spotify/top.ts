import { upsertArtists, upsertTracks } from "../catalog";
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
