import { Crown, Disc3, ListMusic } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Cover } from "@/components/cover";
import { DetailHeader } from "@/components/detail-header";
import { HideButton } from "@/components/hide-button";
import { SubjectStats } from "@/components/subject-stats";
import { TopList } from "@/components/top-list";
import { Section } from "@/components/ui";
import { formatMinutes, formatNumber } from "@/lib/format";
import { ALL_TIME } from "@/lib/ranges";
import { requireUser } from "@/lib/session";
import { getArtistLeaderboard } from "@/lib/social";
import { getArtist, getTopAlbums, getTopTracks } from "@/lib/stats";

export async function generateMetadata({ params }: PageProps<"/artist/[id]">): Promise<Metadata> {
  const artist = await getArtist((await params).id);
  return { title: artist?.name ?? "Artist" };
}

export default async function ArtistPage({ params }: PageProps<"/artist/[id]">) {
  const { id } = await params;
  const user = await requireUser();
  const artist = await getArtist(id);
  if (!artist) notFound();

  const subject = { type: "artist" as const, id };
  const [tracks, albums, listeners] = await Promise.all([
    getTopTracks(user.id, ALL_TIME, "plays", 10, { subject }),
    getTopAlbums(user.id, ALL_TIME, "plays", 5, { subject }),
    getArtistLeaderboard(user.id, id, 10),
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
        actions={<HideButton userId={user.id} type="artist" itemId={artist.id} />}
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

      <SubjectStats userId={user.id} subject={subject} />

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
        {tracks.length > 0 && (
          <Section icon={ListMusic} title="Your most played tracks">
            <TopList items={tracks.map((track) => ({ ...track, href: `/track/${track.id}` }))} />
          </Section>
        )}

        <div className="space-y-12">
          {listeners.length > 0 && (
            <Section
              icon={Crown}
              title="Top listeners"
              description="All-time plays among you and the people whose profiles you can see."
            >
              <ol className="-mx-2">
                {listeners.map((listener, index) => {
                  const isYou = listener.userId === user.id;
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
              {listeners.length === 1 && (
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
            <Section icon={Disc3} title="Albums you played">
              <TopList items={albums.map((album) => ({ ...album, href: `/album/${album.id}` }))} />
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}
