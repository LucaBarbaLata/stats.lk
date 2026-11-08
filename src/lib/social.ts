import { and, eq, or, sql } from "drizzle-orm";
import { db } from "./db";
import { friendships, type User } from "./db/schema";
import { notHiddenSql } from "./stats";

// Friendships, and who may see whose stats. A profile is visible to its
// owner, to anyone with the link when set to "public", to everyone logged in
// when set to "everyone", and to friends when set to "friends". "private"
// profiles are only visible to their owner. The same rule applies to feeds,
// now playing and leaderboards.

export type Relation = "self" | "friends" | "incoming" | "outgoing" | "none";

const pair = (a: string, b: string) =>
  or(
    and(eq(friendships.requesterId, a), eq(friendships.addresseeId, b)),
    and(eq(friendships.requesterId, b), eq(friendships.addresseeId, a)),
  );

export async function getRelation(viewerId: string, otherId: string): Promise<Relation> {
  if (viewerId === otherId) return "self";
  const [row] = await db.select().from(friendships).where(pair(viewerId, otherId));
  if (!row) return "none";
  if (row.status === "accepted") return "friends";
  return row.requesterId === viewerId ? "outgoing" : "incoming";
}

// `relation` is null for visitors who aren't logged in
export function canView(owner: Pick<User, "visibility">, relation: Relation | null): boolean {
  if (owner.visibility === "public") return true;
  if (relation === null) return false;
  return (
    relation === "self" ||
    owner.visibility === "everyone" ||
    (owner.visibility === "friends" && relation === "friends")
  );
}

// SQL condition: the user `u` is visible to the viewer (null: not logged in)
const visibleTo = (viewerId: string | null) =>
  viewerId === null
    ? sql`(u.visibility = 'public')`
    : sql`(
  u.id = ${viewerId}::uuid
  or u.visibility in ('everyone', 'public')
  or (u.visibility = 'friends' and exists (
    select 1 from friendships f where f.status = 'accepted'
      and ((f.requester_id = u.id and f.addressee_id = ${viewerId}::uuid)
        or (f.addressee_id = u.id and f.requester_id = ${viewerId}::uuid))))
)`;

export type Person = Pick<User, "id" | "username" | "displayName" | "avatarUrl" | "visibility"> & {
  relation: Relation;
};

// Everyone else on stats.lk, with how they relate to the viewer
export async function listPeople(viewerId: string): Promise<Person[]> {
  const rows = await db.execute<{
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    visibility: User["visibility"];
    status: "pending" | "accepted" | null;
    requesterId: string | null;
  }>(sql`
    select u.id, u.username, u.display_name as "displayName",
      u.avatar_url as "avatarUrl", u.visibility, f.status, f.requester_id as "requesterId"
    from users u
    left join friendships f on (f.requester_id = u.id and f.addressee_id = ${viewerId}::uuid)
      or (f.addressee_id = u.id and f.requester_id = ${viewerId}::uuid)
    where u.id <> ${viewerId}::uuid
    order by lower(u.display_name)`);
  return rows.map(({ status, requesterId, ...person }) => ({
    ...person,
    relation:
      status === "accepted"
        ? "friends"
        : status === "pending"
          ? requesterId === viewerId
            ? "outgoing"
            : "incoming"
          : "none",
  }));
}

// Sends a friend request, or accepts the other person's pending one.
export async function sendFriendRequest(viewerId: string, otherId: string): Promise<void> {
  const relation = await getRelation(viewerId, otherId);
  if (relation === "incoming") return acceptFriendRequest(viewerId, otherId);
  if (relation !== "none") return;
  await db.insert(friendships).values({ requesterId: viewerId, addresseeId: otherId }).onConflictDoNothing();
}

export async function acceptFriendRequest(viewerId: string, otherId: string): Promise<void> {
  await db
    .update(friendships)
    .set({ status: "accepted" })
    .where(and(eq(friendships.requesterId, otherId), eq(friendships.addresseeId, viewerId)));
}

// Declines, cancels or unfriends, depending on the current state.
export async function removeFriendship(viewerId: string, otherId: string): Promise<void> {
  await db.delete(friendships).where(pair(viewerId, otherId));
}

// Cosine similarity of the two users' minutes per artist, all time, plus
// the artists both listen to most. Hidden artists and tracks don't count.
export async function getTasteMatch(userA: string, userB: string) {
  const [match] = await db.execute<{ score: number }>(sql`
    with a as (
      select ta.artist_id, sum(s.ms_played)::float8 as ms
      from streams s join track_artists ta on ta.track_id = s.track_id
      where s.user_id = ${userA}::uuid and ${notHiddenSql} group by 1
    ), b as (
      select ta.artist_id, sum(s.ms_played)::float8 as ms
      from streams s join track_artists ta on ta.track_id = s.track_id
      where s.user_id = ${userB}::uuid and ${notHiddenSql} group by 1
    )
    select coalesce(
      sum(a.ms * b.ms) / nullif(sqrt((select sum(ms * ms) from a)) * sqrt((select sum(ms * ms) from b)), 0),
      0)::float8 as score
    from a join b using (artist_id)`);
  const shared = await db.execute<{ id: string; name: string; imageUrl: string | null }>(sql`
    with a as (
      select ta.artist_id, sum(s.ms_played)::float8 / sum(sum(s.ms_played)) over () as share
      from streams s join track_artists ta on ta.track_id = s.track_id
      where s.user_id = ${userA}::uuid and ${notHiddenSql} group by 1
    ), b as (
      select ta.artist_id, sum(s.ms_played)::float8 / sum(sum(s.ms_played)) over () as share
      from streams s join track_artists ta on ta.track_id = s.track_id
      where s.user_id = ${userB}::uuid and ${notHiddenSql} group by 1
    )
    select ar.id, ar.name, ar.image_url as "imageUrl"
    from a join b using (artist_id) join artists ar on ar.id = a.artist_id
    order by least(a.share, b.share) desc
    limit 5`);
  return { score: match.score, shared };
}

export type FeedItem = {
  id: string;
  playedMs: number;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  trackId: string;
  trackName: string;
  artistNames: string;
  imageUrl: string | null;
};

// Latest plays of the viewer's friends whose profiles the viewer can see
export async function getFriendsFeed(viewerId: string, limit: number): Promise<FeedItem[]> {
  return db.execute<FeedItem>(sql`
    select s.id::text as id, (extract(epoch from s.played_at) * 1000)::float8 as "playedMs",
      u.id as "userId", u.username, u.display_name as "displayName",
      u.avatar_url as "avatarUrl", t.id as "trackId", t.name as "trackName",
      coalesce(
        (select string_agg(a.name, ', ' order by ta.position)
         from track_artists ta join artists a on a.id = ta.artist_id where ta.track_id = t.id),
        t.imported_artist_name, '') as "artistNames",
      al.image_url as "imageUrl"
    from streams s
    join users u on u.id = s.user_id
    join tracks t on t.id = s.track_id
    left join albums al on al.id = t.album_id
    where u.id <> ${viewerId}::uuid and ${visibleTo(viewerId)}
      and exists (select 1 from friendships f where f.status = 'accepted'
        and ((f.requester_id = u.id and f.addressee_id = ${viewerId}::uuid)
          or (f.addressee_id = u.id and f.requester_id = ${viewerId}::uuid)))
      and s.played_at > now() - interval '7 days'
      and ${notHiddenSql}
    order by s.played_at desc
    limit ${limit}`);
}

export type LeaderboardEntry = {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  streams: number;
  msPlayed: number;
};

// All-time plays of an artist among the users the viewer can see, except
// those who hid the artist
export async function getArtistLeaderboard(
  // null for visitors, who only see public profiles
  viewerId: string | null,
  artistId: string,
  limit: number,
): Promise<LeaderboardEntry[]> {
  return db.execute<LeaderboardEntry>(sql`
    select u.id as "userId", u.username, u.display_name as "displayName",
      u.avatar_url as "avatarUrl", count(*)::int as streams, sum(s.ms_played)::float8 as "msPlayed"
    from streams s
    join track_artists ta on ta.track_id = s.track_id and ta.artist_id = ${artistId}
    join users u on u.id = s.user_id
    where ${visibleTo(viewerId)}
      and (u.id = ${viewerId}::uuid or not exists (
        select 1 from hidden_items h where h.user_id = u.id and h.type = 'artist' and h.item_id = ${artistId}))
    group by u.id
    order by streams desc, "msPlayed" desc
    limit ${limit}`);
}

export type NowPlayingEntry = {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  trackId: string;
  trackName: string;
  artistNames: string;
  imageUrl: string | null;
  durationMs: number | null;
  progressMs: number | null;
  isPlaying: boolean;
  fetchedMs: number;
};

// What these users are playing, limited to what the viewer may see (their
// own always; others only if visible and sharing now playing). Entries older
// than two minutes are dropped: the worker is probably not running.
export async function getNowPlaying(viewerId: string | null, userIds: string[]): Promise<NowPlayingEntry[]> {
  if (!userIds.length) return [];
  const ids = sql.join(userIds.map((id) => sql`${id}::uuid`), sql`, `);
  return db.execute<NowPlayingEntry>(sql`
    select u.id as "userId", u.username, u.display_name as "displayName",
      u.avatar_url as "avatarUrl", t.id as "trackId", t.name as "trackName",
      coalesce(
        (select string_agg(a.name, ', ' order by ta.position)
         from track_artists ta join artists a on a.id = ta.artist_id where ta.track_id = t.id), '') as "artistNames",
      al.image_url as "imageUrl", t.duration_ms as "durationMs", np.progress_ms as "progressMs",
      np.is_playing as "isPlaying", (extract(epoch from np.fetched_at) * 1000)::float8 as "fetchedMs"
    from now_playing np
    join users u on u.id = np.user_id
    join tracks t on t.id = np.track_id
    left join albums al on al.id = t.album_id
    where u.id in (${ids})
      and np.fetched_at > now() - interval '2 minutes'
      and (u.id = ${viewerId ?? null}::uuid or (u.show_now_playing and ${visibleTo(viewerId)} and not exists (
        select 1 from hidden_items h where h.user_id = u.id
          and ((h.type = 'track' and h.item_id = t.id)
            or (h.type = 'artist' and h.item_id in (select artist_id from track_artists where track_id = t.id))))))
    order by np.is_playing desc, lower(u.display_name)`);
}
