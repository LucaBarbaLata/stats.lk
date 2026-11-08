import { Crown, Disc3, ListMusic } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Cover } from "@/components/cover";
import { DetailHeader } from "@/components/detail-header";
import { HideButton } from "@/components/hide-button";
import { SubjectStats, SubjectStatsLogin } from "@/components/subject-stats";
import { TopList } from "@/components/top-list";
import { Section } from "@/components/ui";
import { formatMinutes, formatNumber } from "@/lib/format";
import { ALL_TIME } from "@/lib/ranges";
import { getCurrentUser } from "@/lib/session";
import { getArtistLeaderboard } from "@/lib/social";
import { getArtist, getArtistAlbums, getArtistTracks, getTopAlbums, getTopTracks } from "@/lib/stats";

export async function generateMetadata({ params }: PageProps<"/artist/[id]">): Promise<Metadata> {
  const artist = await getArtist((await params).id);
  return { title: artist?.name ?? "Artist" };
}

// Open to visitors too: instead of their own stats they get the artist's
// songs and albums (without numbers), its public top listeners and a prompt
// to log in
export default async function ArtistPage({ params }: PageProps<"/artist/[id]">) {
  const { id } = await params;
  const user = await getCurrentUser();
  const artist = await getArtist(id);
  if (!artist) notFound();

  const subject = { type: "artist" as const, id };
  const [tracks, albums, listeners] = await Promise.all([
    user ? getTopTracks(user.id, ALL_TIME, "plays", 10, { subject }) : getArtistTracks(id, 10),
    user ? getTopAlbums(user.id, ALL_TIME, "plays", 5, { subject }) : getArtistAlbums(id, 12),
    getArtistLeaderboard(user?.id ?? null, id, 10),
  ]);

  return (
    <div className="space-y-12">
      <DetailHeader
        kind="Artist"
        title={artist.name}
        imageUrl={artist.imageUrl}
        rounded
        spotifyUrl={
          artist.imported
            ? `https://open.spotify.com/search/${encodeURIComponent(artist.name)}`
            : `https://open.spotify.com/artist/${artist.id}`
        }
        actions={user && <HideButton userId={user.id} type="artist" itemId={artist.id} />}
      >
        {artist.genres.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {artist.genres.map((genre) => (
              <li key={genre} className="rounded-full bg-background/40 px-3 py-1 text-sm text-muted first-letter:uppercase">
                {genre}
              </li>
            ))}
          </ul>
        )}
      </DetailHeader>

      {user ? <SubjectStats userId={user.id} subject={subject} /> : <SubjectStatsLogin name={artist.name} />}

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
        {tracks.length > 0 && (
          <Section icon={ListMusic} title={user ? "Your most played tracks" : "Songs"}>
            <TopList ranked={Boolean(user)} items={tracks.map((track) => ({ ...track, href: `/track/${track.id}` }))} />
          </Section>
        )}

        <div className="space-y-12">
          {listeners.length > 0 && (
            <Section
              icon={Crown}
              title="Top listeners"
              description={
                user
                  ? "All-time plays among you and the people whose profiles you can see."
                  : "All-time plays among people with a public profile."
              }
            >
              <ol className="-mx-2">
                {listeners.map((listener, index) => {
                  const isYou = listener.userId === user?.id;
                  return (
                    <li key={listener.userId}>
                      <Link
                        href={`/u/${listener.username}`}
                        className={`flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-surface ${isYou ? "bg-accent-fill/10" : ""}`}
                      >
                        <span className="w-6 text-right text-sm font-medium text-subtle tabular-nums">{index + 1}</span>
                        <Cover src={listener.avatarUrl} size={40} rounded label={listener.displayName} />
                        <span className="min-w-0 flex-1 truncate font-medium">
                          {listener.displayName}
                          {isYou && <span className="ml-2 text-sm font-normal text-muted">you</span>}
                        </span>
                        <span className="shrink-0 text-right text-sm tabular-nums">
                          <span className="block font-medium">{formatNumber(listener.streams)} plays</span>
                          <span className="block text-subtle">{formatMinutes(listener.msPlayed)} min</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
              {user && listeners.length === 1 && (
                <p className="text-sm text-muted">
                  <Link href="/friends" className="text-accent hover:underline">
                    Add friends
                  </Link>{" "}
                  to see how you rank.
                </p>
              )}
            </Section>
          )}

          {albums.length > 0 && (
            <Section icon={Disc3} title={user ? "Albums you played" : "Albums"}>
              <TopList ranked={Boolean(user)} items={albums.map((album) => ({ ...album, href: `/album/${album.id}` }))} />
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}
