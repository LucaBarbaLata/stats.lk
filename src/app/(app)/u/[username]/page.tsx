import { eq } from "drizzle-orm";
import { ListMusic, Lock, LogIn, Mic2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Cover } from "@/components/cover";
import { FriendButton } from "@/components/friend-button";
import { FriendsNowPlaying, MyNowPlaying } from "@/components/now-playing";
import { TopList } from "@/components/top-list";
import { LevelCard, TrophyBadges } from "@/components/trophies";
import { buttonClass, EmptyState, Section } from "@/components/ui";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { PRESETS } from "@/lib/ranges";
import { levelFor } from "@/lib/levels";
import { getCurrentUser } from "@/lib/session";
import { evaluateTrophies } from "@/lib/trophies";
import { getTrophyMetrics } from "@/lib/trophy-metrics";
import { normalizeUsername } from "@/lib/usernames";
import { canView, getNowPlaying, getRelation, getTasteMatch } from "@/lib/social";
import { getTopArtists, getTopGenres, getTopTracks } from "@/lib/stats";

const LAST_4_WEEKS = PRESETS[0];

const VISIBILITY_LABEL = {
  private: "Only you can see your profile",
  friends: "Your friends can see your profile",
  everyone: "Everyone on stats.lk can see your profile",
  public: "Anyone with the link can see your profile",
};

export async function generateMetadata({ params }: PageProps<"/u/[username]">): Promise<Metadata> {
  const [owner] = await db
    .select({ displayName: users.displayName })
    .from(users)
    .where(eq(users.username, normalizeUsername(decodeURIComponent((await params).username))));
  return { title: owner?.displayName ?? "Profile" };
}

export default async function ProfilePage({ params }: PageProps<"/u/[username]">) {
  const handle = decodeURIComponent((await params).username);
  // Public profiles can be opened without an account
  const viewer = await getCurrentUser();
  const [owner] = await db.select().from(users).where(eq(users.username, normalizeUsername(handle)));
  if (!owner) {
    // Links from before usernames used the Spotify ID
    const [bySpotifyId] = await db.select({ username: users.username }).from(users).where(eq(users.spotifyId, handle));
    if (bySpotifyId) permanentRedirect(`/u/${bySpotifyId.username}`);
    notFound();
  }

  const relation = viewer ? await getRelation(viewer.id, owner.id) : null;
  const visible = canView(owner, relation);
  const isSelf = relation === "self";

  const header = (
    <header className="flex flex-col gap-5 sm:flex-row sm:items-center">
      <div className="w-24 shrink-0 sm:w-28">
        <Cover src={owner.avatarUrl} size={112} rounded label={owner.displayName} />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <h1 className="text-[32px] leading-tight font-semibold tracking-[-0.02em] break-words">{owner.displayName}</h1>
          <p className="text-muted">@{owner.username}</p>
        </div>
        {owner.bio && visible && <p className="max-w-xl text-pretty whitespace-pre-line">{owner.bio}</p>}
        {isSelf ? (
          <p className="text-sm text-muted">
            {VISIBILITY_LABEL[owner.visibility]} ·{" "}
            <Link href="/settings/privacy" className="text-accent hover:underline">
              Change
            </Link>
          </p>
        ) : (
          relation === "friends" && <p className="text-sm text-muted">Friends</p>
        )}
      </div>
      {relation && <FriendButton userId={owner.id} relation={relation} />}
    </header>
  );

  if (!visible) {
    return (
      <div className="space-y-8">
        {header}
        {!viewer && owner.visibility !== "private" ? (
          <EmptyState
            icon={LogIn}
            title={`Log in to see ${owner.displayName}'s profile`}
            action={
              <Link href="/login" className={buttonClass("primary", "sm")}>
                Log in
              </Link>
            }
          >
            {owner.visibility === "friends"
              ? "They share it with their friends on stats.lk."
              : "They share it with people on stats.lk."}
          </EmptyState>
        ) : (
          <EmptyState icon={Lock} title={`${owner.displayName}'s profile is private`}>
            {owner.visibility === "friends" && relation !== "friends"
              ? "They share it with friends. Send a friend request to see it."
              : "Only they can see it."}
          </EmptyState>
        )}
      </div>
    );
  }

  // Others don't see what the owner hid; the owner sees everything
  const publicView = { publicOnly: !isSelf };
  const [listening, artists, tracks, genres, match, metrics] = await Promise.all([
    getNowPlaying(viewer?.id ?? null, [owner.id]),
    getTopArtists(owner.id, LAST_4_WEEKS, "minutes", 10, publicView),
    getTopTracks(owner.id, LAST_4_WEEKS, "plays", 10, publicView),
    getTopGenres(owner.id, LAST_4_WEEKS, "minutes", 6, publicView),
    viewer && !isSelf ? getTasteMatch(viewer.id, owner.id) : null,
    getTrophyMetrics(owner.id),
  ]);
  const trophies = evaluateTrophies(metrics);

  return (
    <div className="space-y-12">
      {header}

      <section className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <LevelCard level={levelFor(metrics.totalMinutes)} compact />
        <div className="space-y-3 rounded-3xl bg-surface p-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm text-muted">
              {trophies.filter((trophy) => trophy.tier > 0).length} of {trophies.length} trophies
            </p>
            {isSelf && (
              <Link href="/insights/trophies" className="text-sm text-muted hover:text-foreground">
                See all
              </Link>
            )}
          </div>
          <TrophyBadges trophies={trophies} />
        </div>
      </section>

      {isSelf ? (
        <MyNowPlaying userId={owner.id} initial={listening} />
      ) : (
        listening.length > 0 && <FriendsNowPlaying userIds={[owner.id]} initial={listening} live={Boolean(viewer)} />
      )}

      {match && (
        <section className="flex flex-col gap-5 rounded-3xl bg-accent-fill/12 p-6 ring-1 ring-accent/20 ring-inset sm:flex-row sm:items-center sm:gap-8">
          <div className="shrink-0">
            <p className="text-sm text-muted">Taste match</p>
            <p className="text-[56px] leading-none font-semibold tracking-tight">{Math.round(match.score * 100)}%</p>
          </div>
          {match.shared.length > 0 ? (
            <div className="min-w-0 space-y-2">
              <p className="text-sm text-muted">You both listen to</p>
              <ul className="flex flex-wrap gap-2">
                {match.shared.map((artist) => (
                  <li key={artist.id}>
                    <Link
                      href={`/artist/${artist.id}`}
                      className="flex items-center gap-2 rounded-full bg-surface py-1 pr-3 pl-1 text-sm transition hover:bg-surface-2"
                    >
                      <Cover src={artist.imageUrl} size={24} rounded label={artist.name} />
                      {artist.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-muted">No artists in common yet.</p>
          )}
        </section>
      )}

      {genres.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {genres.map((genre) => (
            <li key={genre.id} className="rounded-full bg-surface px-3.5 py-1.5 text-sm text-muted first-letter:uppercase">
              {genre.name}
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <Section icon={Mic2} title="Top artists of the last 4 weeks">
          {artists.length ? (
            <TopList rounded items={artists.map((artist) => ({ ...artist, href: `/artist/${artist.id}` }))} />
          ) : (
            <p className="text-sm text-muted">No plays in the last 4 weeks.</p>
          )}
        </Section>
        <Section icon={ListMusic} title="Top tracks of the last 4 weeks">
          {tracks.length ? (
            <TopList items={tracks.map((track) => ({ ...track, href: `/track/${track.id}` }))} />
          ) : (
            <p className="text-sm text-muted">No plays in the last 4 weeks.</p>
          )}
        </Section>
      </div>
    </div>
  );
}
