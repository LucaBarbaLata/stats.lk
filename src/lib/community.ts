import { sql } from "drizzle-orm";
import { cacheLife } from "next/cache";
import { db } from "./db";
import { appTimezone } from "./env";

// Numbers for the public presentation page: totals across everyone on
// stats.lk, never one person's. No artist or track names: anyone can sign up
// and imports can be edited, so a ranking could be pushed. Cached for an hour.

export interface CommunityStats {
  totals: { plays: number; minutes: number; artists: number; listeners: number };
  minutesLast7Days: number;
  minutesPrevious7Days: number;
  // Minutes per local day, oldest first, for the last 26 weeks
  days: { day: string; minutes: number }[];
  // Minutes per hour of day (0-23), last 30 days
  hours: number[];
  thisYear: { year: number; minutes: number };
}

export async function getCommunityStats(): Promise<CommunityStats> {
  "use cache";

  const tz = appTimezone();
  const local = sql`(s.played_at at time zone ${tz})`;
  const year = new Date().getFullYear();

  const [totals, week, days, hours, yearTotal] = await Promise.all([
    db.execute<{ plays: number; minutes: number; artists: number; listeners: number }>(sql`
      select count(*)::int as plays, coalesce(sum(s.ms_played), 0)::float8 / 60000 as minutes,
        (select count(distinct ta.artist_id)::int from streams s join track_artists ta on ta.track_id = s.track_id) as artists,
        count(distinct s.user_id)::int as listeners
      from streams s`),
    db.execute<{ last7: number; previous7: number }>(sql`
      select
        coalesce(sum(s.ms_played) filter (where s.played_at >= now() - interval '7 days'), 0)::float8 / 60000 as last7,
        coalesce(sum(s.ms_played) filter (where s.played_at < now() - interval '7 days'), 0)::float8 / 60000 as previous7
      from streams s where s.played_at >= now() - interval '14 days'`),
    db.execute<{ day: string; minutes: number }>(sql`
      select to_char(${local}::date, 'YYYY-MM-DD') as day, sum(s.ms_played)::float8 / 60000 as minutes
      from streams s where s.played_at >= now() - interval '182 days'
      group by 1 order by 1`),
    db.execute<{ hour: number; minutes: number }>(sql`
      select extract(hour from ${local})::int as hour, sum(s.ms_played)::float8 / 60000 as minutes
      from streams s where s.played_at >= now() - interval '30 days'
      group by 1`),
    db.execute<{ minutes: number }>(sql`
      select coalesce(sum(s.ms_played), 0)::float8 / 60000 as minutes
      from streams s where extract(year from ${local}) = ${year}`),
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
    days: [...days],
    hours: Array.from({ length: 24 }, (_, hour) => byHour.get(hour) ?? 0),
    thisYear: { year, minutes: yearTotal[0]?.minutes ?? 0 },
  };
}
