import { sql } from "drizzle-orm";
import { cacheLife } from "next/cache";
import { db } from "./db";
import { appTimezone } from "./env";
import { notHiddenSql } from "./stats";

// Numbers for the public presentation page: totals across everyone on
// stats.lk, never one person's. Cached for an hour.
//
// Artist names only come from plays Spotify reported live (see liveSql). Anyone
// can sign up and edit an export before importing it, so counting imports would
// let people push a name onto a public page.

export interface CommunityArtist {
  name: string;
  imageUrl: string | null;
  plays: number;
  minutes: number;
}

export interface CommunityStats {
  totals: { plays: number; minutes: number; artists: number; listeners: number };
  minutesLast7Days: number;
  minutesPrevious7Days: number;
  // Last 30 days
  topArtists: CommunityArtist[];
  // Minutes per local day, oldest first, for the last 26 weeks
  days: { day: string; minutes: number }[];
  // Minutes per hour of day (0-23), last 30 days
  hours: number[];
  thisYear: { year: number; minutes: number; topArtist: CommunityArtist | null };
}

// Everything except imports that look edited (src/lib/import/check.ts)
const countedSql = sql`(s.source = 'api' or not exists (
  select 1 from import_checks c where c.user_id = s.user_id and c.unusual))`;

// Plays saved from Spotify itself, by people whose profile isn't private, and
// nothing they hid
const liveSql = sql`s.source = 'api' and u.visibility <> 'private' and ${notHiddenSql}`;

// An import can correct how long a live play lasted, but never past the track's length
const liveMinutesSql = sql`sum(least(s.ms_played, coalesce(t.duration_ms, s.ms_played)))::float8 / 60000`;

// Exported for tests; pages use getCommunityStats, which is cached
export function topLiveArtists(since: ReturnType<typeof sql>, limit: number): Promise<CommunityArtist[]> {
  return db.execute<CommunityArtist & Record<string, unknown>>(sql`
    select a.name, a.image_url as "imageUrl", count(*)::int as plays, ${liveMinutesSql} as minutes
    from streams s
    join users u on u.id = s.user_id
    join tracks t on t.id = s.track_id
    join track_artists ta on ta.track_id = s.track_id
    join artists a on a.id = ta.artist_id
    where ${since} and ${liveSql}
    group by a.id
    order by plays desc, minutes desc, a.name
    limit ${limit}`);
}

export async function getCommunityStats(): Promise<CommunityStats> {
  "use cache";

  const tz = appTimezone();
  const local = sql`(s.played_at at time zone ${tz})`;
  const year = new Date().getFullYear();

  const [totals, week, top, days, hours, yearTotal, yearTop] = await Promise.all([
    db.execute<{ plays: number; minutes: number; artists: number; listeners: number }>(sql`
      select count(*)::int as plays, coalesce(sum(s.ms_played), 0)::float8 / 60000 as minutes,
        (select count(distinct ta.artist_id)::int from streams s join track_artists ta on ta.track_id = s.track_id where ${countedSql}) as artists,
        count(distinct s.user_id)::int as listeners
      from streams s where ${countedSql}`),
    db.execute<{ last7: number; previous7: number }>(sql`
      select
        coalesce(sum(s.ms_played) filter (where s.played_at >= now() - interval '7 days'), 0)::float8 / 60000 as last7,
        coalesce(sum(s.ms_played) filter (where s.played_at < now() - interval '7 days'), 0)::float8 / 60000 as previous7
      from streams s where s.played_at >= now() - interval '14 days' and ${countedSql}`),
    topLiveArtists(sql`s.played_at >= now() - interval '30 days'`, 5),
    db.execute<{ day: string; minutes: number }>(sql`
      select to_char(${local}::date, 'YYYY-MM-DD') as day, sum(s.ms_played)::float8 / 60000 as minutes
      from streams s where s.played_at >= now() - interval '182 days' and ${countedSql}
      group by 1 order by 1`),
    db.execute<{ hour: number; minutes: number }>(sql`
      select extract(hour from ${local})::int as hour, sum(s.ms_played)::float8 / 60000 as minutes
      from streams s where s.played_at >= now() - interval '30 days' and ${countedSql}
      group by 1`),
    db.execute<{ minutes: number }>(sql`
      select coalesce(sum(s.ms_played), 0)::float8 / 60000 as minutes
      from streams s where extract(year from ${local}) = ${year} and ${countedSql}`),
    topLiveArtists(sql`extract(year from ${local}) = ${year}`, 1),
  ]);

  // The first visit can come before anyone has plays, and an empty result
  // must not stick around for an hour
  if (totals[0].plays > 0) cacheLife("hours");
  else cacheLife("seconds");

  const byHour = new Map(hours.map((row) => [row.hour, row.minutes]));
  return {
    totals: totals[0],
    minutesLast7Days: week[0].last7,
    minutesPrevious7Days: week[0].previous7,
    topArtists: [...top],
    days: [...days],
    hours: Array.from({ length: 24 }, (_, hour) => byHour.get(hour) ?? 0),
    thisYear: { year, minutes: yearTotal[0]?.minutes ?? 0, topArtist: yearTop[0] ?? null },
  };
}
