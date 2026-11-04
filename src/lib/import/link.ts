import { sql, type SQL } from "drizzle-orm";
import { db } from "../db";

// Streaming history exports name each track's artist and album but give no
// ids, and looking every track up on Spotify takes weeks at its rate limit.
// So imported tracks are linked right away to the artist and album with that
// name, created with `imported` set when we don't know them yet. The artist
// is the main one only; upsertTracks (src/lib/catalog.ts) swaps in the real
// artists and album once Spotify returns the track.

type Database = Pick<typeof db, "execute">;

// Ids of made-up rows hash the name, so importing the same name twice finds
// the same row
const importedArtistId = (name: SQL) => sql`'i' || md5(lower(${name}))`;

// Links imported tracks that have no artist or album yet: the given ones, or
// all of them
export async function linkImportedTracks(database: Database = db, trackIds?: string[]): Promise<void> {
  if (trackIds && !trackIds.length) return;
  const only = trackIds ? sql`and t.id in (${sql.join(trackIds.map((id) => sql`${id}`), sql`, `)})` : sql``;
  const noArtist = sql`t.imported_artist_name is not null ${only}
    and not exists (select 1 from track_artists ta where ta.track_id = t.id)`;

  await database.execute(sql`
    insert into artists (id, name, imported)
    select distinct on (lower(t.imported_artist_name))
      ${importedArtistId(sql`t.imported_artist_name`)}, t.imported_artist_name, true
    from tracks t
    where ${noArtist}
      and not exists (select 1 from artists a where lower(a.name) = lower(t.imported_artist_name))
    on conflict (id) do nothing`);

  // A real artist with this name wins over a made-up one
  await database.execute(sql`
    insert into track_artists (track_id, artist_id, position)
    select t.id, a.id, 0
    from tracks t
    cross join lateral (
      select a.id from artists a
      where lower(a.name) = lower(t.imported_artist_name)
      order by a.imported, a.id
      limit 1
    ) a
    where ${noArtist}
    on conflict do nothing`);

  // Each track with no album, with the album of that name by the same artist
  // if there is one, and otherwise the id a made-up one gets
  const noAlbum = sql`
    select t.id as track_id, t.imported_album_name as album_name, ta.artist_id,
      coalesce(
        (select al.id from albums al
         join album_artists aa on aa.album_id = al.id
         where lower(al.name) = lower(t.imported_album_name) and aa.artist_id = ta.artist_id
         order by al.imported, al.id
         limit 1),
        'i' || md5(ta.artist_id || '|' || lower(t.imported_album_name))) as album_id
    from tracks t
    join track_artists ta on ta.track_id = t.id and ta.position = 0
    where t.album_id is null and t.imported_album_name is not null ${only}`;

  await database.execute(sql`
    insert into albums (id, name, imported)
    select distinct on (w.album_id) w.album_id, w.album_name, true
    from (${noAlbum}) w
    on conflict (id) do nothing`);
  await database.execute(sql`
    insert into album_artists (album_id, artist_id, position)
    select distinct w.album_id, w.artist_id, 0
    from (${noAlbum}) w
    on conflict do nothing`);
  await database.execute(sql`
    update tracks t set album_id = w.album_id
    from (${noAlbum}) w
    where w.track_id = t.id`);
}

// Moves everything from made-up artists to the real artists with the same
// name, keeping what was already found for them. A picture counts as finding
// the artist, so that Spotify's scarce lookups go to what's still unknown.
export async function absorbImportedArtists(database: Database, realIds: string[]): Promise<void> {
  if (!realIds.length) return;
  const pairs = await database.execute<{ imported: string; real: string }>(sql`
    select p.id as imported, r.id as real
    from artists r
    join artists p on p.imported and lower(p.name) = lower(r.name)
    where not r.imported and r.id in (${sql.join(realIds.map((id) => sql`${id}`), sql`, `)})`);

  for (const { imported, real } of pairs) {
    await database.execute(sql`
      insert into track_artists (track_id, artist_id, position)
      select track_id, ${real}, position from track_artists where artist_id = ${imported}
      on conflict do nothing`);
    await database.execute(sql`
      insert into album_artists (album_id, artist_id, position)
      select album_id, ${real}, position from album_artists where artist_id = ${imported}
      on conflict do nothing`);
    await database.execute(sql`
      update hidden_items h set item_id = ${real}
      where h.type = 'artist' and h.item_id = ${imported} and not exists (
        select 1 from hidden_items o where o.user_id = h.user_id and o.type = 'artist' and o.item_id = ${real})`);
    await database.execute(sql`delete from hidden_items where type = 'artist' and item_id = ${imported}`);
    await database.execute(sql`
      update artists r set
        image_url = coalesce(r.image_url, p.image_url),
        picture_looked_up_at = coalesce(r.picture_looked_up_at, p.picture_looked_up_at),
        genres = case when r.genres_fetched_at is null then p.genres else r.genres end,
        genres_fetched_at = coalesce(r.genres_fetched_at, p.genres_fetched_at),
        details_fetched_at = coalesce(r.details_fetched_at, case when p.image_url is not null then now() end)
      from artists p
      where r.id = ${real} and p.id = ${imported}`);
    await database.execute(sql`delete from artists where id = ${imported}`);
  }
}

// Moves tracks from made-up albums to the real albums with the same name by
// the same artist. Call after absorbImportedArtists, so the artists line up.
export async function absorbImportedAlbums(database: Database, realIds: string[]): Promise<void> {
  if (!realIds.length) return;
  const pairs = await database.execute<{ imported: string; real: string }>(sql`
    select distinct p.id as imported, r.id as real
    from albums r
    join album_artists ra on ra.album_id = r.id
    join album_artists pa on pa.artist_id = ra.artist_id
    join albums p on p.id = pa.album_id and p.imported and lower(p.name) = lower(r.name)
    where not r.imported and r.id in (${sql.join(realIds.map((id) => sql`${id}`), sql`, `)})`);

  for (const { imported, real } of pairs) {
    await database.execute(sql`update tracks set album_id = ${real} where album_id = ${imported}`);
    await database.execute(sql`
      update albums r set image_url = coalesce(r.image_url, p.image_url)
      from albums p
      where r.id = ${real} and p.id = ${imported}`);
    await database.execute(sql`delete from albums where id = ${imported}`);
  }
}

// Made-up artists and albums among the given ids that nothing points to anymore
export async function removeUnusedImported(database: Database, artistIds: string[], albumIds: string[]): Promise<void> {
  if (albumIds.length) {
    await database.execute(sql`
      delete from albums a
      where a.imported and a.id in (${sql.join(albumIds.map((id) => sql`${id}`), sql`, `)})
        and not exists (select 1 from tracks t where t.album_id = a.id)`);
  }
  if (artistIds.length) {
    await database.execute(sql`
      delete from artists a
      where a.imported and a.id in (${sql.join(artistIds.map((id) => sql`${id}`), sql`, `)})
        and not exists (select 1 from track_artists ta where ta.artist_id = a.id)`);
  }
}
