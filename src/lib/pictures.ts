import { and, count, desc, eq, isNull } from "drizzle-orm";
import { db } from "./db";
import { albumArtists, albums, artists, streams, trackArtists, tracks } from "./db/schema";

// Pictures for artists and albums from Deezer, whose public search needs no
// key and has no daily limit like Spotify's (about 50 requests per 5 seconds).
// Only names are sent. Results must match the name, because a wrong picture is
// worse than the initial shown without one.

const API_URL = "https://api.deezer.com";

interface DeezerArtist {
  name: string;
  picture_big: string;
}

interface DeezerAlbum {
  title: string;
  cover_big: string;
  artist: { name: string };
}

// Ignores case, accents and punctuation
const simplify = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

async function search<T>(path: string, query: string): Promise<T[]> {
  const res = await fetch(`${API_URL}${path}?${new URLSearchParams({ q: query, limit: "10" })}`);
  const body = await res.json().catch(() => null);
  // Deezer reports errors, its rate limit included, in a 200 response
  if (!res.ok || body?.error) throw new Error(`Deezer: ${body?.error?.message ?? `HTTP ${res.status}`}`);
  return body?.data ?? [];
}

export async function findArtistPicture(name: string): Promise<string | null> {
  const wanted = simplify(name);
  const results = await search<DeezerArtist>("/search/artist", name);
  const match = results.find((artist) => simplify(artist.name) === wanted);
  // Artists with no photo get an address with an empty image hash
  return match && !match.picture_big.includes("/artist//") ? match.picture_big : null;
}

export async function findAlbumCover(artist: string, album: string): Promise<string | null> {
  const clean = (text: string) => text.replace(/"/g, "");
  const wantedArtist = simplify(artist);
  const wanted = simplify(album);
  const results = await search<DeezerAlbum>("/search/album", `artist:"${clean(artist)}" album:"${clean(album)}"`);
  const sameArtist = results.filter((result) => simplify(result.artist.name) === wantedArtist);
  // "Hybrid Theory" may only exist as "Hybrid Theory (Bonus Edition)"
  const match =
    sameArtist.find((result) => simplify(result.title) === wanted) ??
    sameArtist.find((result) => simplify(result.title).startsWith(`${wanted} `));
  return match?.cover_big ?? null;
}

// Looks up pictures for the most played artists and albums that have none.
// An artist Deezer knows needs no Spotify lookup for its picture.
export async function fetchMissingPictures(limit: number): Promise<number> {
  const perKind = Math.ceil(limit / 2);

  const pendingArtists = await db
    .select({ id: artists.id, name: artists.name })
    .from(artists)
    .innerJoin(trackArtists, eq(trackArtists.artistId, artists.id))
    .innerJoin(streams, eq(streams.trackId, trackArtists.trackId))
    .where(and(isNull(artists.imageUrl), isNull(artists.pictureLookedUpAt)))
    .groupBy(artists.id)
    .orderBy(desc(count()))
    .limit(perKind);

  for (const artist of pendingArtists) {
    const imageUrl = await findArtistPicture(artist.name);
    const now = new Date();
    await db
      .update(artists)
      .set({ imageUrl, pictureLookedUpAt: now, ...(imageUrl && { detailsFetchedAt: now }) })
      .where(eq(artists.id, artist.id));
  }

  const pendingAlbums = await db
    .select({ id: albums.id, name: albums.name, artist: artists.name })
    .from(albums)
    .innerJoin(albumArtists, and(eq(albumArtists.albumId, albums.id), eq(albumArtists.position, 0)))
    .innerJoin(artists, eq(artists.id, albumArtists.artistId))
    .innerJoin(tracks, eq(tracks.albumId, albums.id))
    .innerJoin(streams, eq(streams.trackId, tracks.id))
    .where(and(isNull(albums.imageUrl), isNull(albums.pictureLookedUpAt)))
    .groupBy(albums.id, artists.name)
    .orderBy(desc(count()))
    .limit(perKind);

  for (const album of pendingAlbums) {
    const imageUrl = await findAlbumCover(album.artist, album.name);
    await db.update(albums).set({ imageUrl, pictureLookedUpAt: new Date() }).where(eq(albums.id, album.id));
  }

  return pendingArtists.length + pendingAlbums.length;
}
