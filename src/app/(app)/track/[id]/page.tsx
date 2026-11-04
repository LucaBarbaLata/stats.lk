import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Fragment } from "react";
import { DetailHeader } from "@/components/detail-header";
import { HideButton } from "@/components/hide-button";
import { SubjectStats } from "@/components/subject-stats";
import { requireUser } from "@/lib/session";
import { getTrack } from "@/lib/stats";

export async function generateMetadata({ params }: PageProps<"/track/[id]">): Promise<Metadata> {
  const track = await getTrack((await params).id);
  return { title: track?.name ?? "Track" };
}

export default async function TrackPage({ params }: PageProps<"/track/[id]">) {
  const { id } = await params;
  const user = await requireUser();
  const track = await getTrack(id);
  if (!track) notFound();

  return (
    <div className="space-y-12">
      <DetailHeader
        kind="Track"
        title={track.name}
        imageUrl={track.album?.imageUrl ?? null}
        spotifyUrl={`https://open.spotify.com/track/${track.id}`}
        actions={<HideButton userId={user.id} type="track" itemId={track.id} />}
      >
        <p className="text-lg text-muted">
          {track.artists.length
            ? track.artists.map((artist, index) => (
                <Fragment key={artist.id}>
                  {index > 0 && ", "}
                  <Link href={`/artist/${artist.id}`} className="text-foreground hover:underline">
                    {artist.name}
                  </Link>
                </Fragment>
              ))
            : track.importedArtistName}
          {track.album && (
            <>
              {" · "}
              <Link href={`/album/${track.album.id}`} className="hover:underline">
                {track.album.name}
              </Link>
            </>
          )}
        </p>
      </DetailHeader>

      <SubjectStats userId={user.id} subject={{ type: "track", id }} />
    </div>
  );
}
