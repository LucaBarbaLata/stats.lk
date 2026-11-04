import { Compass, History } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { RangeFilter } from "@/components/range-filter";
import { InsightsHeader } from "@/components/sub-nav";
import { TopList } from "@/components/top-list";
import { buttonClass, EmptyState, Notice, Section } from "@/components/ui";
import { formatDate } from "@/lib/dates";
import { formatNumber } from "@/lib/format";
import { parseRange, rangeStart } from "@/lib/ranges";
import { requireUser } from "@/lib/session";
import { getFirstPlayedAt, getForgottenTracks, getListeningTotals, getNewArtists } from "@/lib/stats";

// A track counts as forgotten after this many plays and this long without one
const FORGOTTEN_MIN_PLAYS = 10;
const FORGOTTEN_IDLE_DAYS = 90;

export const metadata: Metadata = { title: "Discover" };

export default async function DiscoverPage({ searchParams }: PageProps<"/insights/discover">) {
  const query = await searchParams;
  const user = await requireUser();
  const range = parseRange(query);

  const [newArtists, forgotten, firstPlayedAt, totals] = await Promise.all([
    getNewArtists(user.id, range, 50),
    getForgottenTracks(user.id, FORGOTTEN_MIN_PLAYS, FORGOTTEN_IDLE_DAYS, 30),
    getFirstPlayedAt(user.id),
    getListeningTotals(user.id),
  ]);
  const start = rangeStart(range);
  // Everything looks new when our history starts inside the range, unless an
  // import already brought in all there is (Spotify doesn't tell us when an
  // account was created, so the import is how we know)
  const historyStartsInRange =
    totals.importedStreams === 0 && firstPlayedAt !== null && (!start || firstPlayedAt > start);

  return (
    <div className="space-y-12">
      <InsightsHeader active="discover" />

      <Section
        icon={Compass}
        title="New artists"
        description={
          newArtists.length > 0
            ? `${formatNumber(newArtists[0].total)} artists you played for the first time in this period.`
            : "Artists you played for the first time in this period."
        }
      >
        <RangeFilter path="/insights/discover" range={range} />
        {historyStartsInRange && firstPlayedAt && (
          <Notice
            icon={History}
            action={
              <Link href="/guide" className={buttonClass("primary", "sm")}>
                Import your history
              </Link>
            }
          >
            Your history here starts {formatDate(firstPlayedAt)}, so every artist since then counts as
            new. Import your full history to see real discoveries.
          </Notice>
        )}
        {newArtists.length ? (
          <TopList
            rounded
            items={newArtists.map((artist) => ({
              ...artist,
              subtitle: `First played ${formatDate(new Date(artist.firstMs))}`,
              href: `/artist/${artist.id}`,
            }))}
          />
        ) : (
          <EmptyState icon={Compass} title="No new artists in this period">
            Try a longer period, or play something you&apos;ve never heard.
          </EmptyState>
        )}
      </Section>

      <Section
        icon={History}
        title="Forgotten favourites"
        description={`Tracks you played at least ${FORGOTTEN_MIN_PLAYS} times but not in the last ${FORGOTTEN_IDLE_DAYS} days.`}
      >
        {forgotten.length ? (
          <TopList
            items={forgotten.map((track) => ({
              ...track,
              subtitle: `${track.subtitle}, last played ${formatDate(new Date(track.lastMs))}`,
              href: `/track/${track.id}`,
            }))}
          />
        ) : (
          <EmptyState
            icon={History}
            title="Nothing forgotten yet"
            action={
              <Link href="/guide" className={buttonClass("secondary", "sm")}>
                Import your history
              </Link>
            }
          >
            This fills up once you have a few months of history here, or right after you import it.
          </EmptyState>
        )}
      </Section>
    </div>
  );
}
