import { ListMusic } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Fragment } from "react";
import { DetailHeader } from "@/components/detail-header";
import { SubjectStats } from "@/components/subject-stats";
import { TopList } from "@/components/top-list";
import { Section } from "@/components/ui";
import { ALL_TIME } from "@/lib/ranges";
import { requireUser } from "@/lib/session";
import { getAlbum, getTopTracks } from "@/lib/stats";

export async function generateMetadata({ params }: PageProps<"/album/[id]">): Promise<Metadata> {
  const album = await getAlbum((await params).id);
  return { title: album?.name ?? "Album" };
}

export default async function AlbumPage({ params }: PageProps<"/album/[id]">) {
  const { id } = await params;
  const user = await requireUser();
  const album = await getAlbum(id);
  if (!album) notFound();

  const subject = { type: "album" as const, id };
  const tracks = await getTopTracks(user.id, ALL_TIME, "plays", 50, { subject });

  return (
    <div className="space-y-12">
      <DetailHeader
        kind={album.albumType === "single" ? "Single" : "Album"}
        title={album.name}
        imageUrl={album.imageUrl}
        spotifyUrl={
          album.imported
            ? `https://open.spotify.com/search/${encodeURIComponent(album.name)}`
            : `https://open.spotify.com/album/${album.id}`
        }
      >
        <p className="text-lg text-muted">
          {album.artists.map((artist, index) => (
            <Fragment key={artist.id}>
              {index > 0 && ", "}
              <Link href={`/artist/${artist.id}`} className="text-foreground hover:underline">
                {artist.name}
              </Link>
            </Fragment>
          ))}
          {album.releaseDate && ` · ${album.releaseDate.slice(0, 4)}`}
        </p>
      </DetailHeader>

      <SubjectStats userId={user.id} subject={subject} />

      {tracks.length > 0 && (
        <Section icon={ListMusic} title="Tracks you played">
          <TopList items={tracks.map((track) => ({ ...track, href: `/track/${track.id}` }))} />
        </Section>
      )}
    </div>
  );
}
