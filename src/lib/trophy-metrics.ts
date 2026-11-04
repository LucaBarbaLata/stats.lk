import { sql } from "drizzle-orm";
import { db } from "./db";
import { computeStreaks, today } from "./dates";
import { appTimezone } from "./env";
import { getTasteMatch } from "./social";
import { getListeningDays } from "./stats";

// The raw numbers the trophies are judged on, all time, in the app timezone.
export interface TrophyMetrics {
  totalMinutes: number;
  nightPlays: number;
  earlyPlays: number;
  weekendMinutes: number;
  bestDayMinutes: number;
  longestStreak: number;
  bestMonthNewArtists: number;
  genres: number;
  oldTrackPlays: number;
  freshPlays: number;
  artists: number;
  longestArtistRun: number;
  bestTrackDay: number;
  topArtistPlays: number;
  bestAlbumDepth: number;
  bestArtistDepth: number;
  friends: number;
  bestTasteMatch: number;
  artistsLed: number;
  imported: number;
}

type Row = Record<string, number>;

export async function getTrophyMetrics(userId: string): Promise<TrophyMetrics> {
  const tz = appTimezone();
  const local = sql`(s.played_at at time zone ${tz})`;
  const mine = sql`s.user_id = ${userId}::uuid`;

  const [habits, days, explorer, genres, eras, loyalty, depth, social, listeningDays] = await Promise.all([
    db.execute<Row>(sql`
      select coalesce(sum(s.ms_played), 0)::float8 / 60000 as "totalMinutes",
        count(*) filter (where extract(hour from ${local}) < 5)::int as "nightPlays",
        count(*) filter (where extract(hour from ${local}) between 5 and 7)::int as "earlyPlays",
        coalesce(sum(s.ms_played) filter (where extract(isodow from ${local}) >= 6), 0)::float8 / 60000 as "weekendMinutes",
        (count(*) filter (where s.source = 'import'))::int as imported,
        (select count(distinct ta.artist_id)::int from streams s join track_artists ta on ta.track_id = s.track_id where ${mine}) as artists
      from streams s where ${mine}`),
    db.execute<Row>(sql`
      select
        (select coalesce(max(day_ms), 0)::float8 / 60000 from (
          select sum(s.ms_played) as day_ms from streams s where ${mine} group by ${local}::date
        ) per_day) as "bestDayMinutes",
        (select coalesce(max(n), 0)::int from (
          select count(*) as n from streams s where ${mine} group by ${local}::date, s.track_id
        ) per_track_day) as "bestTrackDay"`),
    // The first month of anyone's history makes every artist "new", so it doesn't count
    db.execute<Row>(sql`
      with firsts as (
        select date_trunc('month', min(s.played_at) at time zone ${tz}) as month
        from streams s join track_artists ta on ta.track_id = s.track_id
        where ${mine} group by ta.artist_id
      )
      select coalesce(max(n), 0)::int as "bestMonthNewArtists" from (
        select month, count(*) as n from firsts
        where month > (select min(month) from firsts)
        group by month
      ) months`),
    db.execute<Row>(sql`
      select count(distinct g.genre)::int as genres
      from streams s
      join track_artists ta on ta.track_id = s.track_id and ta.position = 0
      join artists a on a.id = ta.artist_id
      cross join lateral unnest(a.genres) as g(genre)
      where ${mine}`),
    db.execute<Row>(sql`
      select
        count(*) filter (where al.release_date ~ '^\\d{4}' and left(al.release_date, 4)::int < 1980)::int as "oldTrackPlays",
        count(*) filter (
          where al.release_date ~ '^\\d{4}-\\d{2}-\\d{2}$'
            and s.played_at >= al.release_date::date
            and s.played_at < al.release_date::date + 7
        )::int as "freshPlays"
      from streams s join tracks t on t.id = s.track_id join albums al on al.id = t.album_id
      where ${mine}`),
    // Longest run of consecutive days with the same artist (gaps and islands)
    db.execute<Row>(sql`
      select coalesce(max(run), 0)::int as "longestArtistRun",
        (select coalesce(max(n), 0)::int from (
          select count(*) as n from streams s join track_artists ta on ta.track_id = s.track_id
          where ${mine} group by ta.artist_id
        ) per_artist) as "topArtistPlays"
      from (
        select artist_id, count(*) as run from (
          select artist_id, day, day - (row_number() over (partition by artist_id order by day))::int as island
          from (
            select distinct ta.artist_id, ${local}::date as day
            from streams s join track_artists ta on ta.track_id = s.track_id
            where ${mine}
          ) artist_days
        ) numbered group by artist_id, island
      ) runs`),
    db.execute<Row>(sql`
      select
        (select coalesce(max(n), 0)::int from (
          select count(distinct s.track_id) as n from streams s join tracks t on t.id = s.track_id
          where ${mine} and t.album_id is not null group by t.album_id
        ) per_album) as "bestAlbumDepth",
        (select coalesce(max(n), 0)::int from (
          select count(distinct s.track_id) as n from streams s join track_artists ta on ta.track_id = s.track_id
          where ${mine} group by ta.artist_id
        ) per_artist) as "bestArtistDepth"`),
    // Friends, and the artists you've played more than every friend who shares their profile
    db.execute<{ friendIds: string[] | null; artistsLed: number }>(sql`
      with friends as (
        select case when f.requester_id = ${userId}::uuid then f.addressee_id else f.requester_id end as id
        from friendships f
        where f.status = 'accepted' and (f.requester_id = ${userId}::uuid or f.addressee_id = ${userId}::uuid)
      ),
      visible_friends as (
        select fr.id from friends fr join users u on u.id = fr.id where u.visibility <> 'private'
      ),
      counts as (
        select s.user_id, ta.artist_id, count(*) as n
        from streams s join track_artists ta on ta.track_id = s.track_id
        where s.user_id = ${userId}::uuid or s.user_id in (select id from visible_friends)
        group by 1, 2
      )
      select (select array_agg(id::text) from friends) as "friendIds",
        (select count(*)::int from counts mine_c
         where mine_c.user_id = ${userId}::uuid
           and exists (select 1 from visible_friends)
           and mine_c.n > coalesce((select max(n) from counts other
                                    where other.artist_id = mine_c.artist_id and other.user_id <> ${userId}::uuid), 0)
        ) as "artistsLed"`),
    getListeningDays(userId),
  ]);

  const friendIds = social[0]?.friendIds ?? [];
  const matches = await Promise.all(friendIds.map((id) => getTasteMatch(userId, id)));

  return {
    totalMinutes: habits[0].totalMinutes,
    nightPlays: habits[0].nightPlays,
    earlyPlays: habits[0].earlyPlays,
    weekendMinutes: habits[0].weekendMinutes,
    bestDayMinutes: days[0].bestDayMinutes,
    longestStreak: computeStreaks(listeningDays, today()).longest?.length ?? 0,
    bestMonthNewArtists: explorer[0].bestMonthNewArtists,
    genres: genres[0].genres,
    oldTrackPlays: eras[0].oldTrackPlays,
    freshPlays: eras[0].freshPlays,
    artists: habits[0].artists,
    longestArtistRun: loyalty[0].longestArtistRun,
    bestTrackDay: days[0].bestTrackDay,
    topArtistPlays: loyalty[0].topArtistPlays,
    bestAlbumDepth: depth[0].bestAlbumDepth,
    bestArtistDepth: depth[0].bestArtistDepth,
    friends: friendIds.length,
    bestTasteMatch: Math.round(Math.max(0, ...matches.map((match) => match.score)) * 100),
    artistsLed: social[0]?.artistsLed ?? 0,
    imported: habits[0].imported,
  };
}
