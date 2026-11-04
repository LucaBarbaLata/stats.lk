import { and, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "./db";
import { albumArtists, albums, artists, streams, trackArtists, tracks, workerHeartbeat } from "./db/schema";
import { absorbImportedAlbums, absorbImportedArtists, removeUnusedImported } from "./import/link";
import { getArtistGenres } from "./lastfm";
import { getAppAccessToken, pickImage, spotifyGet, SpotifyError } from "./spotify/api";
import type { SpotifyArtist, SpotifySimpleArtist, SpotifyTrack } from "./spotify/types";

// Store tracks (with their albums and artists) as returned by the Web API.
export async function upsertTracks(input: SpotifyTrack[]): Promise<void> {
  const list = [...new Map(input.filter((t) => t.id).map((t) => [t.id, t])).values()];
  if (!list.length) return;

  const albumList = [...new Map(list.map((t) => [t.album.id, t.album])).values()];
  const artistMap = new Map<string, SpotifySimpleArtist>();
  for (const track of list) {
    for (const artist of [...track.artists, ...track.album.artists]) {
      artistMap.set(artist.id, artist);
    }
  }

  const trackIds = list.map((track) => track.id!);
  await db.transaction(async (tx) => {
    // The made-up artists and album of an imported track, which Spotify's
    // answer replaces (src/lib/import/link.ts)
    const replacedAlbums = await tx
      .select({ id: albums.id })
      .from(tracks)
      .innerJoin(albums, eq(albums.id, tracks.albumId))
      .where(and(inArray(tracks.id, trackIds), eq(albums.imported, true)));
    const replacedArtists = await tx
      .select({ id: artists.id })
      .from(trackArtists)
      .innerJoin(artists, eq(artists.id, trackArtists.artistId))
      .where(and(inArray(trackArtists.trackId, trackIds), eq(artists.imported, true)));
    if (replacedArtists.length) {
      await tx
        .delete(trackArtists)
        .where(and(inArray(trackArtists.trackId, trackIds), inArray(trackArtists.artistId, replacedArtists.map((a) => a.id))));
    }

    await tx
      .insert(artists)
      .values([...artistMap.values()].map((a) => ({ id: a.id, name: a.name })))
      .onConflictDoNothing();

    await tx
      .insert(albums)
      .values(
        albumList.map((album) => ({
          id: album.id,
          name: album.name,
          imageUrl: pickImage(album.images),
          albumType: album.album_type,
          releaseDate: album.release_date,
        })),
      )
      .onConflictDoUpdate({
        target: albums.id,
        set: {
          name: sql`excluded.name`,
          imageUrl: sql`excluded.image_url`,
          albumType: sql`excluded.album_type`,
          releaseDate: sql`excluded.release_date`,
        },
      });

    await tx
      .insert(albumArtists)
      .values(
        albumList.flatMap((album) =>
          album.artists.map((artist, position) => ({
            albumId: album.id,
            artistId: artist.id,
            position,
          })),
        ),
      )
      .onConflictDoNothing();

    await tx
      .insert(tracks)
      .values(
        list.map((track) => ({
          id: track.id!,
          name: track.name,
          albumId: track.album.id,
          durationMs: track.duration_ms,
          explicit: track.explicit,
          detailsFetchedAt: new Date(),
        })),
      )
      .onConflictDoUpdate({
        target: tracks.id,
        set: {
          name: sql`excluded.name`,
          albumId: sql`excluded.album_id`,
          durationMs: sql`excluded.duration_ms`,
          explicit: sql`excluded.explicit`,
          detailsFetchedAt: sql`excluded.details_fetched_at`,
        },
      });

    await tx
      .insert(trackArtists)
      .values(
        list.flatMap((track) =>
          track.artists.map((artist, position) => ({
            trackId: track.id!,
            artistId: artist.id,
            position,
          })),
        ),
      )
      .onConflictDoNothing();

    await absorbImportedArtists(tx, [...artistMap.keys()]);
    await absorbImportedAlbums(tx, albumList.map((album) => album.id));
    await removeUnusedImported(tx, replacedArtists.map((a) => a.id), replacedAlbums.map((a) => a.id));
  });
}

// Store full artist objects (e.g. from the user's Spotify top list). They take
// over from made-up artists of the same name, plays included.
export async function upsertArtists(input: SpotifyArtist[]): Promise<void> {
  if (!input.length) return;
  await db.transaction(async (tx) => {
    await tx
      .insert(artists)
      .values(
        input.map((artist) => ({
          id: artist.id,
          name: artist.name,
          imageUrl: pickImage(artist.images),
          detailsFetchedAt: new Date(),
        })),
      )
      .onConflictDoUpdate({
        target: artists.id,
        set: {
          name: sql`excluded.name`,
          // Spotify's photo wins, but an artist it has none for keeps Deezer's
          imageUrl: sql`coalesce(excluded.image_url, artists.image_url)`,
          detailsFetchedAt: sql`excluded.details_fetched_at`,
        },
      });
    await absorbImportedArtists(tx, input.map((artist) => artist.id));
  });
}

// Imported plays only carry a track ID and names. Look the tracks up on
// Spotify one by one (there is no batch endpoint anymore), most played
// first so that top lists fill in quickly.
export async function fetchMissingTrackDetails(limit: number): Promise<number> {
  const pending = await db
    .select({ id: tracks.id })
    .from(tracks)
    .innerJoin(streams, eq(streams.trackId, tracks.id))
    .where(isNull(tracks.detailsFetchedAt))
    .groupBy(tracks.id)
    .orderBy(desc(count()))
    .limit(limit);
  if (!pending.length) return 0;

  const token = await getAppAccessToken();
  for (const { id } of pending) {
    let track: SpotifyTrack | null = null;
    try {
      track = await spotifyGet<SpotifyTrack>(`/tracks/${id}`, token);
    } catch (error) {
      if (!(error instanceof SpotifyError && (error.status === 404 || error.status === 400))) {
        throw error;
      }
    }
    if (track) {
      // Keep our ID even if Spotify relinked the track to another one
      await upsertTracks([{ ...track, id }]);
    } else {
      await db.update(tracks).set({ detailsFetchedAt: new Date() }).where(eq(tracks.id, id));
    }
  }
  return pending.length;
}

// Genres come from Last.fm, most played artists first. Skipped while
// LASTFM_API_KEY isn't set.
export async function fetchMissingGenres(limit: number): Promise<number> {
  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) return 0;

  const pending = await db
    .select({ id: artists.id, name: artists.name })
    .from(artists)
    .innerJoin(trackArtists, eq(trackArtists.artistId, artists.id))
    .innerJoin(streams, eq(streams.trackId, trackArtists.trackId))
    .where(isNull(artists.genresFetchedAt))
    .groupBy(artists.id)
    .orderBy(desc(count()))
    .limit(limit);

  for (const artist of pending) {
    const genres = await getArtistGenres(artist.name, apiKey);
    await db
      .update(artists)
      .set({ genres: genres ?? [], genresFetchedAt: new Date() })
      .where(eq(artists.id, artist.id));
  }
  return pending.length;
}

// Track objects only carry simplified artists (no image), and Spotify
// removed the batch endpoint, so artists are fetched one by one, most played
// first. Spotify's photo replaces any picture found on Deezer in the meantime.
export async function fetchMissingArtistDetails(limit: number): Promise<number> {
  const pending = await db
    .select({ id: artists.id })
    .from(artists)
    .leftJoin(trackArtists, eq(trackArtists.artistId, artists.id))
    .leftJoin(streams, eq(streams.trackId, trackArtists.trackId))
    .where(and(isNull(artists.detailsFetchedAt), eq(artists.imported, false)))
    .groupBy(artists.id)
    .orderBy(desc(count(streams.trackId)))
    .limit(limit);
  if (!pending.length) return 0;

  const token = await getAppAccessToken();
  for (const { id } of pending) {
    let artist: SpotifyArtist | null = null;
    try {
      artist = await spotifyGet<SpotifyArtist>(`/artists/${id}`, token);
    } catch (error) {
      // Unknown or removed artist: mark it as fetched so we don't retry forever
      if (!(error instanceof SpotifyError && (error.status === 404 || error.status === 400))) {
        throw error;
      }
    }
    await db
      .update(artists)
      .set({
        ...(artist && { name: artist.name, imageUrl: pickImage(artist.images) ?? sql`${artists.imageUrl}` }),
        detailsFetchedAt: new Date(),
      })
      .where(eq(artists.id, id));
  }
  return pending.length;
}

// One round of Spotify lookups, artists first because they're few and on
// screen. When Spotify's rate limit stops them (in November 2026, after about
// 650 lookups for almost 24 hours) they wait as long as Spotify asks, and the
// caller's syncing and now playing carry on.
export async function fetchMissingCatalogDetails(limit: number): Promise<{ tracks: number; artists: number }> {
  const fetched = { tracks: 0, artists: 0 };
  const [heartbeat] = await db.select({ pausedUntil: workerHeartbeat.catalogPausedUntil }).from(workerHeartbeat);
  if (heartbeat?.pausedUntil && heartbeat.pausedUntil.getTime() > Date.now()) return fetched;
  try {
    fetched.artists = await fetchMissingArtistDetails(limit);
    fetched.tracks = await fetchMissingTrackDetails(limit - fetched.artists);
  } catch (error) {
    if (!(error instanceof SpotifyError && error.status === 429)) throw error;
    const seconds = error.retryAfterSeconds ?? 30;
    await db
      .update(workerHeartbeat)
      .set({ catalogPausedUntil: new Date(Date.now() + seconds * 1000) })
      .where(eq(workerHeartbeat.id, 1));
    console.warn(`${error.message}, pausing catalog lookups for ${seconds}s`);
  }
  return fetched;
}
