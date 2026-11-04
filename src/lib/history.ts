import { sql } from "drizzle-orm";
import { today } from "./dates";
import { db } from "./db";
import { appTimezone } from "./env";

// Looking back over a long history: today in earlier years, and the stretches
// when one artist ruled.

export type OnThisDay = {
  year: number;
  plays: number;
  msPlayed: number;
  trackId: string;
  trackName: string;
  artistNames: string;
  imageUrl: string | null;
};

// Today's date in earlier years, newest first, with the most played track of each
export async function getOnThisDay(userId: string, limit: number): Promise<OnThisDay[]> {
  const tz = appTimezone();
  const day = today();
  return db.execute<OnThisDay>(sql`
    with per_track as (
      select extract(year from s.played_at at time zone ${tz})::int as year, s.track_id,
        count(*)::int as plays, sum(s.ms_played)::float8 as ms
      from streams s
      where s.user_id = ${userId}
        and to_char(s.played_at at time zone ${tz}, 'MM-DD') = ${day.slice(5)}
        and (s.played_at at time zone ${tz})::date < ${day}::date
      group by 1, 2
    ),
    per_year as (
      select year, sum(plays)::int as plays, sum(ms)::float8 as ms,
        (array_agg(track_id order by plays desc, ms desc))[1] as track_id
      from per_track
      group by year
    )
    select y.year, y.plays, y.ms as "msPlayed", t.id as "trackId", t.name as "trackName",
      al.image_url as "imageUrl",
      coalesce(
        (select string_agg(a.name, ', ' order by ta.position)
         from track_artists ta join artists a on a.id = ta.artist_id where ta.track_id = t.id),
        t.imported_artist_name, '') as "artistNames"
    from per_year y
    join tracks t on t.id = y.track_id
    left join albums al on al.id = t.album_id
    order by y.year desc
    limit ${limit}`);
}

export type Era = {
  artistId: string;
  artistName: string;
  imageUrl: string | null;
  // "YYYY-MM", first and last month
  from: string;
  to: string;
  months: number;
  plays: number;
  msPlayed: number;
  // Of everything played in those months, 0 to 100
  share: number;
};

// A month this quiet says little about what you were into
const MIN_MONTH_MS = 2 * 60 * 60 * 1000;

// The most played artist of each month, with months in a row by the same
// artist joined into one era. Newest first. Counts main artists only.
export async function getEras(userId: string): Promise<Era[]> {
  const tz = appTimezone();
  const months = await db.execute<{
    month: string;
    artistId: string;
    artistName: string;
    imageUrl: string | null;
    plays: number;
    ms: number;
    total: number;
  }>(sql`
    with monthly as (
      select to_char(s.played_at at time zone ${tz}, 'YYYY-MM') as month, ta.artist_id,
        count(*)::int as plays, sum(s.ms_played)::float8 as ms
      from streams s
      join track_artists ta on ta.track_id = s.track_id and ta.position = 0
      where s.user_id = ${userId}
      group by 1, 2
    ),
    totals as (select month, sum(ms)::float8 as total from monthly group by month),
    leaders as (
      select distinct on (m.month) m.month, m.artist_id, m.plays, m.ms, t.total
      from monthly m
      join totals t on t.month = m.month
      where t.total >= ${MIN_MONTH_MS}
      order by m.month, m.ms desc
    )
    select l.month, l.artist_id as "artistId", a.name as "artistName", a.image_url as "imageUrl",
      l.plays, l.ms, l.total
    from leaders l
    join artists a on a.id = l.artist_id
    order by l.month`);

  const eras: (Era & { total: number })[] = [];
  for (const month of months) {
    const era = eras.at(-1);
    if (era?.artistId === month.artistId) {
      era.to = month.month;
      era.months++;
      era.plays += month.plays;
      era.msPlayed += month.ms;
      era.total += month.total;
    } else {
      eras.push({
        artistId: month.artistId,
        artistName: month.artistName,
        imageUrl: month.imageUrl,
        from: month.month,
        to: month.month,
        months: 1,
        plays: month.plays,
        msPlayed: month.ms,
        total: month.total,
        share: 0,
      });
    }
  }
  return eras.map(({ total, ...era }) => ({ ...era, share: Math.round((era.msPlayed / total) * 100) })).reverse();
}
