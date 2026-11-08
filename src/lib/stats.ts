import { desc, eq, sql, type SQL } from "drizzle-orm";
import { db } from "./db";
import { albums, artists, streams, trackArtists, tracks } from "./db/schema";
import { appTimezone } from "./env";
import type { Range } from "./ranges";

// Most queries below are raw SQL over `streams s`. Raw results come back
// untyped by the driver: numbers are cast to int/float8 and timestamps are
// returned as epoch milliseconds.

export type Sort = "plays" | "minutes";

// What a detail page is about: plays of a track, of any track by an artist,
// or of any track on an album.
export type Subject = { type: "track" | "artist" | "album"; id: string };

// `column` is the timestamp to filter on, the play time by default
function rangeSql(range: Range, column: SQL = sql`s.played_at`): SQL {
  const tz = appTimezone();
  if (range.key === "custom") {
    return sql`${column} >= (${range.from}::date)::timestamp at time zone ${tz}
      and ${column} < ((${range.to}::date) + 1)::timestamp at time zone ${tz}`;
  }
  return range.days ? sql`${column} >= now() - make_interval(days => ${range.days}::int)` : sql`true`;
}

function subjectSql(subject: Subject): SQL {
  if (subject.type === "track") return sql`s.track_id = ${subject.id}`;
  if (subject.type === "artist") {
    return sql`exists (select 1 from track_artists ta
      where ta.track_id = s.track_id and ta.artist_id = ${subject.id})`;
  }
  return sql`s.track_id in (select id from tracks where album_id = ${subject.id})`;
}

const orderSql = (sort: Sort) =>
  sort === "minutes" ? sql`"msPlayed" desc, streams desc` : sql`streams desc, "msPlayed" desc`;

const toDate = (ms: number | null) => (ms === null ? null : new Date(ms));

// The play `s` involves no artist or track its listener hid from others
export const notHiddenSql = sql`not exists (
  select 1 from hidden_items h
  where h.user_id = s.user_id
    and ((h.type = 'track' and h.item_id = s.track_id)
      or (h.type = 'artist' and h.item_id in (select artist_id from track_artists where track_id = s.track_id))))`;

export interface TopOptions {
  subject?: Subject;
  // Leave out what the user hid from others (for profiles and share cards)
  publicOnly?: boolean;
}

const optionsSql = ({ subject, publicOnly }: TopOptions) =>
  sql`${subject ? subjectSql(subject) : sql`true`} and ${publicOnly ? notHiddenSql : sql`true`}`;

// ---------------------------------------------------------------- overview

export async function getListeningTotals(userId: string) {
  const tz = appTimezone();
  const startOfToday = sql`date_trunc('day', now() at time zone ${tz}) at time zone ${tz}`;
  const [totals] = await db
    .select({
      streams: sql<number>`count(*)::int`,
      importedStreams: sql<number>`count(*) filter (where ${streams.source} = 'import')::int`,
      msTotal: sql`coalesce(sum(${streams.msPlayed}), 0)`.mapWith(Number),
      msToday: sql`coalesce(sum(${streams.msPlayed}) filter (where ${streams.playedAt} >= ${startOfToday}), 0)`.mapWith(Number),
      msLast7Days: sql`coalesce(sum(${streams.msPlayed}) filter (where ${streams.playedAt} >= now() - interval '7 days'), 0)`.mapWith(Number),
    })
    .from(streams)
    .where(eq(streams.userId, userId));
  return totals;
}

export async function getFirstPlayedAt(userId: string): Promise<Date | null> {
  const [row] = await db
    .select({ first: sql`min(${streams.playedAt})`.mapWith(streams.playedAt) })
    .from(streams)
    .where(eq(streams.userId, userId));
  return row?.first ?? null;
}

export function getRecentStreams(userId: string, limit: number) {
  return db
    .select({
      id: streams.id,
      playedAt: streams.playedAt,
      trackId: tracks.id,
      trackName: tracks.name,
      albumImageUrl: albums.imageUrl,
      artistNames: sql<string>`coalesce(
        (select string_agg(${artists.name}, ', ' order by ${trackArtists.position})
         from ${trackArtists} join ${artists} on ${artists.id} = ${trackArtists.artistId}
         where ${trackArtists.trackId} = ${tracks.id}),
        ${tracks.importedArtistName}, '')`,
    })
    .from(streams)
    .innerJoin(tracks, eq(tracks.id, streams.trackId))
    .leftJoin(albums, eq(albums.id, tracks.albumId))
    .where(eq(streams.userId, userId))
    .orderBy(desc(streams.playedAt))
    .limit(limit);
}

// --------------------------------------------------------------- top lists

export type TopItem = {
  id: string;
  name: string;
  imageUrl: string | null;
  subtitle: string;
  streams: number;
  msPlayed: number;
};

export async function getTopTracks(
  userId: string,
  range: Range,
  sort: Sort,
  limit: number,
  options: TopOptions = {},
): Promise<TopItem[]> {
  return db.execute<TopItem>(sql`
    select t.id, t.name, al.image_url as "imageUrl",
      coalesce(
        (select string_agg(a.name, ', ' order by ta.position)
         from track_artists ta join artists a on a.id = ta.artist_id where ta.track_id = t.id),
        t.imported_artist_name, '') as subtitle,
      count(*)::int as streams, sum(s.ms_played)::float8 as "msPlayed"
    from streams s
    join tracks t on t.id = s.track_id
    left join albums al on al.id = t.album_id
    where s.user_id = ${userId} and ${rangeSql(range)} and ${optionsSql(options)}
    group by t.id, al.id
    order by ${orderSql(sort)}, t.name
    limit ${limit}`);
}

export async function getTopArtists(
  userId: string,
  range: Range,
  sort: Sort,
  limit: number,
  options: TopOptions = {},
): Promise<TopItem[]> {
  return db.execute<TopItem>(sql`
    select a.id, a.name, a.image_url as "imageUrl",
      array_to_string(a.genres[1:2], ', ') as subtitle,
      count(*)::int as streams, sum(s.ms_played)::float8 as "msPlayed"
    from streams s
    join track_artists ta on ta.track_id = s.track_id
    join artists a on a.id = ta.artist_id
    where s.user_id = ${userId} and ${rangeSql(range)} and ${optionsSql(options)}
    group by a.id
    order by ${orderSql(sort)}, a.name
    limit ${limit}`);
}

export async function getTopAlbums(
  userId: string,
  range: Range,
  sort: Sort,
  limit: number,
  options: TopOptions = {},
): Promise<TopItem[]> {
  return db.execute<TopItem>(sql`
    select al.id, al.name, al.image_url as "imageUrl",
      coalesce(
        (select string_agg(a.name, ', ' order by aa.position)
         from album_artists aa join artists a on a.id = aa.artist_id where aa.album_id = al.id),
        '') as subtitle,
      count(*)::int as streams, sum(s.ms_played)::float8 as "msPlayed"
    from streams s
    join tracks t on t.id = s.track_id
    join albums al on al.id = t.album_id
    where s.user_id = ${userId} and ${rangeSql(range)} and ${optionsSql(options)}
    group by al.id
    order by ${orderSql(sort)}, al.name
    limit ${limit}`);
}

// Each play counts towards every genre of the track's main artist.
export async function getTopGenres(
  userId: string,
  range: Range,
  sort: Sort,
  limit: number,
  options: TopOptions = {},
): Promise<TopItem[]> {
  return db.execute<TopItem>(sql`
    select g.genre as id, g.genre as name, null as "imageUrl", '' as subtitle,
      count(*)::int as streams, sum(s.ms_played)::float8 as "msPlayed"
    from streams s
    join track_artists ta on ta.track_id = s.track_id and ta.position = 0
    join artists a on a.id = ta.artist_id
    cross join lateral unnest(a.genres) as g(genre)
    where s.user_id = ${userId} and ${rangeSql(range)} and ${optionsSql(options)}
    group by g.genre
    order by ${orderSql(sort)}, g.genre
    limit ${limit}`);
}

// ---------------------------------------------------------------- activity

export type Bucket = {
  key: string;
  streams: number;
  msPlayed: number;
};

// Plays grouped by hour of day ("0".."23"), ISO weekday ("1" = Monday ..
// "7") or month ("2024-03"), in the app timezone.
export async function getActivity(
  userId: string,
  by: "hour" | "weekday" | "month",
  range: Range,
  subject?: Subject,
): Promise<Bucket[]> {
  const tz = appTimezone();
  const local = sql`(s.played_at at time zone ${tz})`;
  const bucket =
    by === "hour"
      ? sql`extract(hour from ${local})::int::text`
      : by === "weekday"
        ? sql`extract(isodow from ${local})::int::text`
        : sql`to_char(${local}, 'YYYY-MM')`;
  return db.execute<Bucket>(sql`
    select ${bucket} as key, count(*)::int as streams, sum(s.ms_played)::float8 as "msPlayed"
    from streams s
    where s.user_id = ${userId} and ${rangeSql(range)} and ${subject ? subjectSql(subject) : sql`true`}
    group by 1
    order by 1`);
}

// Minutes per local day ("2024-03-01"), from `sinceDays` days ago.
export async function getDailyMinutes(userId: string, sinceDays: number): Promise<Bucket[]> {
  const tz = appTimezone();
  return db.execute<Bucket>(sql`
    select to_char((s.played_at at time zone ${tz})::date, 'YYYY-MM-DD') as key,
      count(*)::int as streams, sum(s.ms_played)::float8 as "msPlayed"
    from streams s
    where s.user_id = ${userId} and s.played_at >= now() - make_interval(days => ${sinceDays}::int)
    group by 1
    order by 1`);
}

export type DayPlay = {
  id: string;
  // Local clock time, "14:03"
  time: string;
  msPlayed: number;
  trackId: string;
  trackName: string;
  artistNames: string;
  imageUrl: string | null;
};

// One local day's plays, oldest first. `tz` is passed in because this also
// runs from a server action, where appTimezone() can't see the user's zone.
export async function getPlaysOnDay(userId: string, day: string, tz: string): Promise<DayPlay[]> {
  return db.execute<DayPlay>(sql`
    select s.id::text as id, to_char(s.played_at at time zone ${tz}, 'HH24:MI') as time,
      s.ms_played as "msPlayed", t.id as "trackId", t.name as "trackName", al.image_url as "imageUrl",
      coalesce(
        (select string_agg(a.name, ', ' order by ta.position)
         from track_artists ta join artists a on a.id = ta.artist_id where ta.track_id = t.id),
        t.imported_artist_name, '') as "artistNames"
    from streams s
    join tracks t on t.id = s.track_id
    left join albums al on al.id = t.album_id
    where s.user_id = ${userId}::uuid
      and s.played_at >= ${day}::date::timestamp at time zone ${tz}
      and s.played_at < (${day}::date + 1)::timestamp at time zone ${tz}
    order by s.played_at`);
}

// Every local day with at least one play, oldest first
export async function getListeningDays(userId: string): Promise<string[]> {
  const tz = appTimezone();
  const rows = await db.execute<{ day: string }>(sql`
    select distinct to_char((s.played_at at time zone ${tz})::date, 'YYYY-MM-DD') as day
    from streams s where s.user_id = ${userId} order by 1`);
  return rows.map((row) => row.day);
}

// ----------------------------------------------------------- detail pages

export async function getSubjectSummary(userId: string, subject: Subject) {
  const tz = appTimezone();
  const [summary] = await db.execute<{
    streams: number;
    msPlayed: number;
    firstMs: number | null;
    lastMs: number | null;
  }>(sql`
    select count(*)::int as streams, coalesce(sum(s.ms_played), 0)::float8 as "msPlayed",
      (extract(epoch from min(s.played_at)) * 1000)::float8 as "firstMs",
      (extract(epoch from max(s.played_at)) * 1000)::float8 as "lastMs"
    from streams s
    where s.user_id = ${userId} and ${subjectSql(subject)}`);
  const [topDay] = await db.execute<{ day: string; streams: number }>(sql`
    select to_char((s.played_at at time zone ${tz})::date, 'YYYY-MM-DD') as day, count(*)::int as streams
    from streams s
    where s.user_id = ${userId} and ${subjectSql(subject)}
    group by 1
    order by 2 desc, 1 desc
    limit 1`);
  return {
    streams: summary.streams,
    msPlayed: summary.msPlayed,
    firstPlayedAt: toDate(summary.firstMs),
    lastPlayedAt: toDate(summary.lastMs),
    topDay: topDay ?? null,
  };
}

export async function getArtist(id: string) {
  const [artist] = await db.select().from(artists).where(eq(artists.id, id));
  return artist ?? null;
}

export async function getTrack(id: string) {
  const [row] = await db
    .select({ track: tracks, album: albums })
    .from(tracks)
    .leftJoin(albums, eq(albums.id, tracks.albumId))
    .where(eq(tracks.id, id));
  if (!row) return null;
  const trackArtistList = await db
    .select({ id: artists.id, name: artists.name })
    .from(trackArtists)
    .innerJoin(artists, eq(artists.id, trackArtists.artistId))
    .where(eq(trackArtists.trackId, id))
    .orderBy(trackArtists.position);
  return { ...row.track, album: row.album, artists: trackArtistList };
}

export async function getAlbum(id: string) {
  const [album] = await db.select().from(albums).where(eq(albums.id, id));
  if (!album) return null;
  const albumArtistList = await db.execute<{ id: string; name: string }>(sql`
    select a.id, a.name from album_artists aa join artists a on a.id = aa.artist_id
    where aa.album_id = ${id} order by aa.position`);
  return { ...album, artists: albumArtistList };
}

// What stats.lk knows of an artist's or album's music, for the pages anyone
// can open. Only music someone played is known; plays people hid from others
// don't count. Lists come without numbers.
export type CatalogItem = { id: string; name: string; imageUrl: string | null; subtitle: string };

// Plays of the track `t` by anyone, for ordering
const publicPlaysSql = sql`(select count(*) from streams s where s.track_id = t.id and ${notHiddenSql})`;

// Most played first, with the album as subtitle
export async function getArtistTracks(artistId: string, limit: number): Promise<CatalogItem[]> {
  return db.execute<CatalogItem>(sql`
    select t.id, t.name, al.image_url as "imageUrl", coalesce(al.name, t.imported_album_name, '') as subtitle
    from (select t.*, ${publicPlaysSql} as plays
          from tracks t join track_artists ta on ta.track_id = t.id and ta.artist_id = ${artistId}) t
    left join albums al on al.id = t.album_id
    where t.plays > 0
    order by t.plays desc, t.name
    limit ${limit}`);
}

// Newest first, with year and type ("2009 · Album") as subtitle
export async function getArtistAlbums(artistId: string, limit: number): Promise<CatalogItem[]> {
  return db.execute<CatalogItem>(sql`
    select al.id, al.name, al.image_url as "imageUrl",
      concat_ws(' · ', left(al.release_date, 4), initcap(al.album_type)) as subtitle
    from albums al
    join album_artists aa on aa.album_id = al.id and aa.artist_id = ${artistId}
    where exists (select 1 from streams s join tracks t on t.id = s.track_id where t.album_id = al.id and ${notHiddenSql})
    order by al.release_date desc nulls last, al.name
    limit ${limit}`);
}

// Most played first, with the artists as subtitle
export async function getAlbumTracks(albumId: string, limit: number): Promise<CatalogItem[]> {
  return db.execute<CatalogItem>(sql`
    select t.id, t.name, al.image_url as "imageUrl",
      coalesce(
        (select string_agg(a.name, ', ' order by ta.position)
         from track_artists ta join artists a on a.id = ta.artist_id where ta.track_id = t.id),
        t.imported_artist_name, '') as subtitle
    from (select t.*, ${publicPlaysSql} as plays from tracks t where t.album_id = ${albumId}) t
    left join albums al on al.id = t.album_id
    where t.plays > 0
    order by t.plays desc, t.name
    limit ${limit}`);
}

// -------------------------------------------------------------- insights

export async function getPeriodTotals(userId: string, range: Range) {
  const [totals] = await db.execute<{
    streams: number;
    msPlayed: number;
    tracks: number;
    artists: number;
    albums: number;
  }>(sql`
    select count(*)::int as streams, coalesce(sum(s.ms_played), 0)::float8 as "msPlayed",
      count(distinct s.track_id)::int as tracks,
      (select count(distinct ta.artist_id)::int from streams s
       join track_artists ta on ta.track_id = s.track_id
       where s.user_id = ${userId} and ${rangeSql(range)}) as artists,
      count(distinct t.album_id)::int as albums
    from streams s
    left join tracks t on t.id = s.track_id
    where s.user_id = ${userId} and ${rangeSql(range)}`);
  return totals;
}

// Plays and minutes in the range for specific tracks or artists (used to put
// numbers next to Spotify's own ranking).
export async function getCountsForIds(
  userId: string,
  kind: "track" | "artist",
  ids: string[],
  range: Range,
): Promise<Map<string, { streams: number; msPlayed: number }>> {
  if (!ids.length) return new Map();
  const list = sql.join(ids.map((id) => sql`${id}`), sql`, `);
  const rows = await db.execute<{ id: string; streams: number; msPlayed: number }>(
    kind === "track"
      ? sql`
        select s.track_id as id, count(*)::int as streams, sum(s.ms_played)::float8 as "msPlayed"
        from streams s
        where s.user_id = ${userId} and ${rangeSql(range)} and s.track_id in (${list})
        group by s.track_id`
      : sql`
        select ta.artist_id as id, count(*)::int as streams, sum(s.ms_played)::float8 as "msPlayed"
        from streams s join track_artists ta on ta.track_id = s.track_id
        where s.user_id = ${userId} and ${rangeSql(range)} and ta.artist_id in (${list})
        group by ta.artist_id`,
  );
  return new Map(rows.map((row) => [row.id, { streams: row.streams, msPlayed: row.msPlayed }]));
}

export type NewArtist = TopItem & { firstMs: number; total: number };

// Artists first played in the range, with all their plays since then.
// `total` is the number of new artists in the range (beyond `limit`).
export async function getNewArtists(userId: string, range: Range, limit: number): Promise<NewArtist[]> {
  return db.execute<NewArtist>(sql`
    with firsts as (
      select ta.artist_id, min(s.played_at) as first_at
      from streams s join track_artists ta on ta.track_id = s.track_id
      where s.user_id = ${userId}
      group by ta.artist_id
    )
    select a.id, a.name, a.image_url as "imageUrl", '' as subtitle,
      (extract(epoch from f.first_at) * 1000)::float8 as "firstMs",
      count(*)::int as streams, sum(s.ms_played)::float8 as "msPlayed",
      (count(*) over ())::int as total
    from firsts f
    join artists a on a.id = f.artist_id
    join track_artists ta on ta.artist_id = f.artist_id
    join streams s on s.track_id = ta.track_id and s.user_id = ${userId}
    where ${rangeSql(range, sql`f.first_at`)}
    group by a.id, f.first_at
    order by streams desc, a.name
    limit ${limit}`);
}

export type ForgottenTrack = TopItem & { lastMs: number };

// Tracks played at least `minPlays` times but not in the last `idleDays` days
export async function getForgottenTracks(
  userId: string,
  minPlays: number,
  idleDays: number,
  limit: number,
): Promise<ForgottenTrack[]> {
  return db.execute<ForgottenTrack>(sql`
    select t.id, t.name, al.image_url as "imageUrl",
      coalesce(
        (select string_agg(a.name, ', ' order by ta.position)
         from track_artists ta join artists a on a.id = ta.artist_id where ta.track_id = t.id),
        t.imported_artist_name, '') as subtitle,
      count(*)::int as streams, sum(s.ms_played)::float8 as "msPlayed",
      (extract(epoch from max(s.played_at)) * 1000)::float8 as "lastMs"
    from streams s
    join tracks t on t.id = s.track_id
    left join albums al on al.id = t.album_id
    where s.user_id = ${userId}
    group by t.id, al.id
    having count(*) >= ${minPlays}::int and max(s.played_at) < now() - make_interval(days => ${idleDays}::int)
    order by streams desc, t.name
    limit ${limit}`);
}

// Minutes and plays per local day, oldest first
export async function getDailyTotals(userId: string, range: Range): Promise<Bucket[]> {
  const tz = appTimezone();
  return db.execute<Bucket>(sql`
    select to_char((s.played_at at time zone ${tz})::date, 'YYYY-MM-DD') as key,
      count(*)::int as streams, sum(s.ms_played)::float8 as "msPlayed"
    from streams s
    where s.user_id = ${userId} and ${rangeSql(range)}
    group by 1
    order by 1`);
}

// How many artists the user heard for the first time on each local day
export async function getArtistDiscoveriesByDay(userId: string): Promise<{ day: string; artists: number }[]> {
  const tz = appTimezone();
  return db.execute<{ day: string; artists: number }>(sql`
    with firsts as (
      select min(s.played_at) as first_at
      from streams s join track_artists ta on ta.track_id = s.track_id
      where s.user_id = ${userId}
      group by ta.artist_id
    )
    select to_char((first_at at time zone ${tz})::date, 'YYYY-MM-DD') as day, count(*)::int as artists
    from firsts group by 1 order by 1`);
}

export type PlayMilestone = {
  type: "artist" | "track";
  id: string;
  name: string;
  imageUrl: string | null;
  plays: number;
  reachedMs: number;
};

// When an artist or a track reached one of the play counts in `artistPlays` /
// `trackPlays` (e.g. the 100th play of an artist), newest first.
export async function getPlayMilestones(
  userId: string,
  artistPlays: number[],
  trackPlays: number[],
  limit: number,
): Promise<PlayMilestone[]> {
  const list = (values: number[]) => sql.join(values.map((value) => sql`${value}::int`), sql`, `);
  return db.execute<PlayMilestone>(sql`
    (select 'artist' as type, a.id, a.name, a.image_url as "imageUrl", r.n::int as plays,
       (extract(epoch from r.played_at) * 1000)::float8 as "reachedMs"
     from (
       select ta.artist_id, s.played_at,
         row_number() over (partition by ta.artist_id order by s.played_at) as n
       from streams s join track_artists ta on ta.track_id = s.track_id
       where s.user_id = ${userId}
     ) r join artists a on a.id = r.artist_id
     where r.n in (${list(artistPlays)}))
    union all
    (select 'track' as type, t.id, t.name, al.image_url as "imageUrl", r.n::int as plays,
       (extract(epoch from r.played_at) * 1000)::float8 as "reachedMs"
     from (
       select s.track_id, s.played_at,
         row_number() over (partition by s.track_id order by s.played_at) as n
       from streams s where s.user_id = ${userId}
     ) r join tracks t on t.id = r.track_id
     left join albums al on al.id = t.album_id
     where r.n in (${list(trackPlays)}))
    order by "reachedMs" desc
    limit ${limit}`);
}

// Years with at least one play, newest first
export async function getListeningYears(userId: string): Promise<number[]> {
  const tz = appTimezone();
  const rows = await db.execute<{ year: number }>(sql`
    select distinct extract(year from s.played_at at time zone ${tz})::int as year
    from streams s where s.user_id = ${userId} order by 1 desc`);
  return rows.map((row) => row.year);
}
