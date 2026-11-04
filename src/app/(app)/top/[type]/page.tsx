import { ChartColumn, History, Share2, Tags } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RangeFilter } from "@/components/range-filter";
import { SubNav } from "@/components/sub-nav";
import { buttonClass, EmptyState, Notice, PageHeader, Segmented } from "@/components/ui";
import { TopList, type TopListItem } from "@/components/top-list";
import { TopSummary } from "@/components/top-summary";
import { formatDate } from "@/lib/dates";
import { formatMinutes, formatNumber } from "@/lib/format";
import { parseRange, rangeQuery, rangeStart, type Range } from "@/lib/ranges";
import { requireUser } from "@/lib/session";
import { getSpotifyTop, type SpotifyTopItem } from "@/lib/spotify/top";
import {
  getFirstPlayedAt,
  getTopAlbums,
  getTopArtists,
  getTopGenres,
  getCountsForIds,
  getPeriodTotals,
  getTopTracks,
  type Sort,
} from "@/lib/stats";

const TYPES = {
  tracks: { label: "Tracks", href: (id: string) => `/track/${id}` },
  artists: { label: "Artists", href: (id: string) => `/artist/${id}` },
  albums: { label: "Albums", href: (id: string) => `/album/${id}` },
  genres: { label: "Genres", href: null },
} as const;
type TopType = keyof typeof TYPES;

const LIMIT = 50;
// Our data covers a range if the first play is at most this long after its start
const COVERAGE_SLACK_MS = 2 * 24 * 60 * 60 * 1000;

const QUERIES = {
  tracks: getTopTracks,
  artists: getTopArtists,
  albums: getTopAlbums,
  genres: getTopGenres,
};

// Spotify's ranking has no numbers; add the plays we have saved for the
// period (null when there are none).
async function withSavedCounts(
  userId: string,
  type: "tracks" | "artists",
  items: SpotifyTopItem[],
  range: Range,
): Promise<TopListItem[]> {
  const counts = await getCountsForIds(userId, type === "tracks" ? "track" : "artist", items.map((item) => item.id), range);
  return items.map((item) => {
    const count = counts.get(item.id);
    return { ...item, streams: count?.streams ?? null, msPlayed: count?.msPlayed ?? null };
  });
}

export async function generateMetadata({ params }: PageProps<"/top/[type]">): Promise<Metadata> {
  const { type } = await params;
  return { title: type in TYPES ? `Top ${TYPES[type as TopType].label.toLowerCase()}` : "Top" };
}

export default async function TopPage({ params, searchParams }: PageProps<"/top/[type]">) {
  const [{ type: rawType }, query] = await Promise.all([params, searchParams]);
  if (!(rawType in TYPES)) notFound();
  const type = rawType as TopType;
  const user = await requireUser();
  // Without a range or sort in the URL, the user's defaults from Settings > Preferences
  const range = parseRange(query, user.defaultRange as Range["key"]);
  const sort: Sort = query.sort === "minutes" || query.sort === "plays" ? query.sort : (user.defaultSort as Sort);
  const forceOwnData = query.source === "stats";

  const firstPlayedAt = await getFirstPlayedAt(user.id);
  const start = rangeStart(range);
  const covered = !start || (firstPlayedAt !== null && firstPlayedAt.getTime() - start.getTime() <= COVERAGE_SLACK_MS);

  // Until we have history for the range, show Spotify's own ranking
  const spotifyTerm = range.key !== "custom" ? range.spotifyTerm : null;
  const useSpotify = !covered && !forceOwnData && spotifyTerm && (type === "tracks" || type === "artists");
  const spotifyItems = useSpotify ? await getSpotifyTop(user.id, type, spotifyTerm).catch(() => null) : null;

  const [ranked, totals] = await Promise.all([
    spotifyItems ? withSavedCounts(user.id, type as "tracks" | "artists", spotifyItems, range) : QUERIES[type](user.id, range, sort, LIMIT),
    getPeriodTotals(user.id, range),
  ]);
  const items: TopListItem[] = ranked;
  const href = TYPES[type].href;
  const linked = items.map((item) => ({ ...item, href: href ? href(item.id) : undefined }));
  const [first] = linked;
  const periodLabel = range.key === "custom" ? range.label : `Last ${range.label.toLowerCase()}`.replace("Last all time", "All time");
  const distinct = {
    tracks: { label: "Tracks", value: totals.tracks },
    artists: { label: "Artists", value: totals.artists },
    albums: { label: "Albums", value: totals.albums },
    genres: { label: "Genres", value: linked.length },
  }[type];

  const base = `/top/${type}`;
  const keep = { sort, ...(forceOwnData ? { source: "stats" } : {}) };

  const sortHref = (option: Sort) =>
    `${base}?${rangeQuery(range)}&sort=${option}${forceOwnData ? "&source=stats" : ""}`;

  return (
    <div className="space-y-8">
      <div className="space-y-6">
        <PageHeader
          title={`Top ${TYPES[type].label.toLowerCase()}`}
          actions={
            (type === "tracks" || type === "artists") && (
              <Link
                href={`/share?card=top-${type}&range=${range.key === "custom" ? "4w" : range.key}`}
                className={`${buttonClass("secondary", "sm")} lg:hidden`}
              >
                <Share2 className="size-4" /> Share
              </Link>
            )
          }
        />
        <SubNav
          label="Top lists"
          items={(Object.keys(TYPES) as TopType[]).map((key) => ({
            href: `/top/${key}?${rangeQuery(range)}&sort=${sort}`,
            label: TYPES[key].label,
            active: key === type,
          }))}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <RangeFilter path={base} range={range} keep={keep} />
        {!spotifyItems && (
          <Segmented
            label="Sort by"
            items={[
              { href: sortHref("plays"), label: "By plays", active: sort === "plays" },
              { href: sortHref("minutes"), label: "By minutes", active: sort === "minutes" },
            ]}
          />
        )}
      </div>

      {!covered && (
        <Notice
          icon={History}
          title={spotifyItems ? "Ranked by Spotify, counted by stats.lk" : undefined}
          action={
            <Link href="/guide" className={buttonClass("primary", "sm")}>
              Import your history
            </Link>
          }
        >
          {spotifyItems ? (
            <>
              Your history here starts {firstPlayedAt ? formatDate(firstPlayedAt) : "today"}, so the order
              comes from Spotify and the numbers only count plays since then. You can also{" "}
              <Link href={`${base}?${rangeQuery(range)}&sort=${sort}&source=stats`} className="text-accent hover:underline">
                rank by the plays saved so far
              </Link>
              .
            </>
          ) : (
            <>
              Based on plays since {firstPlayedAt ? formatDate(firstPlayedAt) : "today"}, when your
              history here starts. Import it to cover the whole period.
            </>
          )}
        </Notice>
      )}

      {linked.length ? (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-10">
          <TopList
            items={linked}
            rounded={type === "artists"}
            covers={type !== "genres"}
            capitalize={type === "genres"}
            bars={sort}
          />
          <TopSummary
            periodLabel={periodLabel}
            totals={totals}
            distinct={distinct}
            firstRounded={type === "artists"}
            first={
              first && type !== "genres"
                ? {
                    name: first.name,
                    imageUrl: first.imageUrl,
                    href: first.href,
                    caption:
                      first.streams === undefined || first.streams === null
                        ? "Spotify's number one for you"
                        : `${formatNumber(first.streams)} plays, ${formatMinutes(first.msPlayed ?? 0)} minutes`,
                  }
                : undefined
            }
            shareHref={
              type === "tracks" || type === "artists"
                ? `/share?card=top-${type}&range=${range.key === "custom" ? "4w" : range.key}`
                : undefined
            }
          />
        </div>
      ) : type === "genres" ? (
        <EmptyState icon={Tags} title="No genres yet">
          Genres appear once your artists are matched with Last.fm, usually within a minute.
        </EmptyState>
      ) : (
        <EmptyState icon={ChartColumn} title="No plays in this period">
          Pick a longer period, or import your history to fill in the past.
        </EmptyState>
      )}
    </div>
  );
}
