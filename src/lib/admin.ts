import { sql } from "drizzle-orm";
import { db } from "./db";

// Read-only numbers for the admin panel

export type AdminUser = {
  id: string;
  username: string;
  displayName: string;
  visibility: string;
  createdMs: number;
  lastSyncedMs: number | null;
  syncError: string | null;
  tokenRevoked: boolean;
  streams: number;
  imported: number;
  lastPlayedMs: number | null;
};

const epochMs = (column: string) => sql.raw(`(extract(epoch from ${column}) * 1000)::float8`);

export function getAdminUsers(): Promise<AdminUser[]> {
  return db.execute<AdminUser>(sql`
    select u.id, u.username, u.display_name as "displayName", u.visibility::text as visibility,
      ${epochMs("u.created_at")} as "createdMs", ${epochMs("u.last_synced_at")} as "lastSyncedMs",
      u.sync_error as "syncError", coalesce(st.revoked_at is not null, true) as "tokenRevoked",
      coalesce(s.streams, 0)::int as streams, coalesce(s.imported, 0)::int as imported,
      ${epochMs("s.last_played")} as "lastPlayedMs"
    from users u
    left join spotify_tokens st on st.user_id = u.id
    left join (
      select user_id, count(*) as streams, count(*) filter (where source = 'import') as imported,
        max(played_at) as last_played
      from streams group by user_id
    ) s on s.user_id = u.id
    order by u.created_at`);
}

export async function getSystemStats() {
  const [stats] = await db.execute<{
    streams: number;
    tracks: number;
    tracksPending: number;
    artists: number;
    artistsPending: number;
    genresPending: number;
    friendships: number;
    databaseBytes: number;
    lastBeatMs: number | null;
    lastSyncMs: number | null;
    workerOk: boolean;
  }>(sql`
    select
      (select count(*) from streams)::int as streams,
      (select count(*) from tracks)::int as tracks,
      (select count(*) from tracks where details_fetched_at is null)::int as "tracksPending",
      (select count(*) from artists)::int as artists,
      (select count(*) from artists where details_fetched_at is null)::int as "artistsPending",
      -- Only artists with plays get genres (see fetchMissingGenres)
      (select count(*) from artists a where genres_fetched_at is null
        and exists (select 1 from track_artists ta join streams s on s.track_id = ta.track_id
                    where ta.artist_id = a.id))::int as "genresPending",
      (select count(*) from friendships where status = 'accepted')::int as friendships,
      pg_database_size(current_database())::float8 as "databaseBytes",
      ${epochMs("(select beat_at from worker_heartbeat)")} as "lastBeatMs",
      ${epochMs("(select max(last_synced_at) from users)")} as "lastSyncMs",
      -- The worker beats every loop (15 s plus the work it does)
      coalesce((select beat_at from worker_heartbeat) > now() - interval '2 minutes', false) as "workerOk"`);
  return stats;
}
