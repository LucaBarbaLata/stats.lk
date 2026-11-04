import { and, count, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "./db";
import { albumArtists, albums, artists, streams, tracks } from "./db/schema";

// Pictures for artists and albums from Deezer, whose public search needs no
// key and has no daily limit like Spotify's (about 50 requests per 5 seconds).
// Only names are sent. A wrong picture is worse than the initial shown without
// one, so a result has to prove it's the right artist or album.

const API_URL = "https://api.deezer.com";
// Most played tracks to try per artist
const TRACKS_TO_TRY = 2;

interface DeezerArtist {
  name: string;
  picture_big: string;
}

interface DeezerTrack {
  title: string;
  artist: DeezerArtist;
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

// A title without what differs between catalogs: "(feat. X)", "- Remastered 2021"
const baseTitle = (title: string) => title.replace(/\s+-\s.*$/, "").replace(/\s*[(\[].*$/, "") || title;

// Artists with no photo get an address with an empty image hash
const photoOf = (artist: DeezerArtist) => (artist.picture_big.includes("/artist//") ? null : artist.picture_big);

async function search<T>(path: string, query: string): Promise<T[]> {
  const res = await fetch(`${API_URL}${path}?${new URLSearchParams({ q: query, limit: "10" })}`);
  const body = await res.json().catch(() => null);
  // Deezer reports errors, its rate limit included, in a 200 response
  if (!res.ok || body?.error) throw new Error(`Deezer: ${body?.error?.message ?? `HTTP ${res.status}`}`);
  return body?.data ?? [];
}

// Lots of artists share a name, so the right one is whoever made the tracks
// that were played. With no such track, a name is only enough if it's unique.
export async function findArtistPicture(name: string, playedTracks: string[]): Promise<string | null> {
  const wanted = simplify(name);
  for (const track of playedTracks) {
    const title = baseTitle(track);
    const results = await search<DeezerTrack>("/search/track", `${name} ${title}`);
    const match = results.find(
      (result) => simplify(result.artist.name) === wanted && simplify(baseTitle(result.title)) === simplify(title),
    );
    if (match) return photoOf(match.artist);
  }
  const sameName = (await search<DeezerArtist>("/search/artist", name)).filter((artist) => simplify(artist.name) === wanted);
  return sameName.length === 1 ? photoOf(sameName[0]) : null;
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
// They're shown until Spotify's own arrive, see fetchMissingArtistDetails.
export async function fetchMissingPictures(limit: number): Promise<number> {
  const perKind = Math.ceil(limit / 2);

  const pendingArtists = await db.execute<{ id: string; name: string; tracks: string[] }>(sql`
    select a.id, a.name, array(
      select t.name from track_artists played
      join tracks t on t.id = played.track_id
      join streams s on s.track_id = t.id
      where played.artist_id = a.id and t.name <> 'Unknown track'
      group by t.id
      order by count(*) desc
      limit ${TRACKS_TO_TRY}) as tracks
    from artists a
    join track_artists ta on ta.artist_id = a.id
    join streams s on s.track_id = ta.track_id
    where a.image_url is null and a.picture_looked_up_at is null
    group by a.id
    order by count(*) desc
    limit ${perKind}`);

  for (const artist of pendingArtists) {
    const imageUrl = await findArtistPicture(artist.name, artist.tracks);
    await db.update(artists).set({ imageUrl, pictureLookedUpAt: new Date() }).where(eq(artists.id, artist.id));
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
