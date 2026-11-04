import { sql } from "drizzle-orm";
import { db } from "../db";

export type ImportProgressData = {
  plays: number;
  firstPlayedMs: number | null;
  pictures: { done: number; total: number };
  // Null when Last.fm isn't set up, so nothing is waiting for it
  genres: { done: number; total: number } | null;
  // Tracks Spotify has confirmed. Weeks for a big import, so it doesn't count
  // towards `percent`: the app is complete without it.
  spotify: { done: number; total: number };
  percent: number;
  done: boolean;
  workerActive: boolean;
};

// How far a user's imported history has got: plays and links are there as soon
// as the upload ends, then the worker adds pictures and genres.
export async function getImportProgress(userId: string): Promise<ImportProgressData> {
  const [row] = await db.execute<{
    plays: number;
    firstPlayedMs: number | null;
    tracks: number;
    tracksChecked: number;
    artists: number;
    artistsPictured: number;
    artistsTagged: number;
    albums: number;
    albumsPictured: number;
    workerActive: boolean | null;
  }>(sql`
    with mine as (select distinct track_id from streams where user_id = ${userId}),
    my_artists as (
      select distinct ta.artist_id as id from mine m
      join track_artists ta on ta.track_id = m.track_id and ta.position = 0
    ),
    my_albums as (
      select distinct t.album_id as id from mine m
      join tracks t on t.id = m.track_id
      where t.album_id is not null
    )
    select
      (select count(*)::int from streams where user_id = ${userId} and source = 'import') as plays,
      (select (extract(epoch from min(played_at)) * 1000)::float8 from streams where user_id = ${userId}) as "firstPlayedMs",
      (select count(*)::int from mine) as tracks,
      (select count(*)::int from mine m join tracks t on t.id = m.track_id
       where t.details_fetched_at is not null) as "tracksChecked",
      (select count(*)::int from my_artists) as artists,
      (select count(*)::int from my_artists m join artists a on a.id = m.id
       where a.image_url is not null or a.picture_looked_up_at is not null) as "artistsPictured",
      (select count(*)::int from my_artists m join artists a on a.id = m.id
       where a.genres_fetched_at is not null) as "artistsTagged",
      (select count(*)::int from my_albums) as albums,
      (select count(*)::int from my_albums m join albums al on al.id = m.id
       where al.image_url is not null or al.picture_looked_up_at is not null) as "albumsPictured",
      (select now() - beat_at < interval '2 minutes' from worker_heartbeat limit 1) as "workerActive"`);

  const pictures = { done: row.artistsPictured + row.albumsPictured, total: row.artists + row.albums };
  const genres = process.env.LASTFM_API_KEY ? { done: row.artistsTagged, total: row.artists } : null;
  const done = pictures.done + (genres?.done ?? 0);
  const total = pictures.total + (genres?.total ?? 0);

  return {
    plays: row.plays,
    firstPlayedMs: row.firstPlayedMs,
    pictures,
    genres,
    spotify: { done: row.tracksChecked, total: row.tracks },
    // Rounded down, so 100 always means finished
    percent: total ? Math.floor((done / total) * 100) : 100,
    done: done >= total,
    workerActive: Boolean(row.workerActive),
  };
}
