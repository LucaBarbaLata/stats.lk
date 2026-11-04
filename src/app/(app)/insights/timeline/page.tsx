import { CalendarRange, ChevronRight, Crown, History, Layers, Waypoints } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Cover } from "@/components/cover";
import { StatCard } from "@/components/stat-card";
import { InsightsHeader } from "@/components/sub-nav";
import { EmptyState, Section } from "@/components/ui";
import { formatMinutes, formatNumber } from "@/lib/format";
import { getEras, type Era } from "@/lib/history";
import { yearRange } from "@/lib/periods";
import { requireUser } from "@/lib/session";
import { getListeningYears, getPeriodTotals, getTopArtists, getTopTracks } from "@/lib/stats";

export const metadata: Metadata = { title: "Timeline" };

const monthName = (month: string) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

const eraDates = (era: Era) => (era.from === era.to ? monthName(era.from) : `${monthName(era.from)} – ${monthName(era.to)}`);

const monthCount = (months: number) => `${months} ${months === 1 ? "month" : "months"}`;

export default async function TimelinePage() {
  const user = await requireUser();
  const [years, eras] = await Promise.all([getListeningYears(user.id), getEras(user.id)]);
  const summaries = await Promise.all(
    years.map(async (year) => {
      const range = yearRange(year);
      const [totals, artists, tracks] = await Promise.all([
        getPeriodTotals(user.id, range),
        getTopArtists(user.id, range, "minutes", 1),
        getTopTracks(user.id, range, "plays", 1),
      ]);
      return { year, totals, artist: artists[0], track: tracks[0] };
    }),
  );
  const loudest = Math.max(1, ...summaries.map((summary) => summary.totals.msPlayed));

  const longest = eras.reduce<Era | null>((best, era) => (!best || era.months > best.months ? era : best), null);
  const monthsOnTop = new Map<string, { name: string; months: number }>();
  for (const era of eras) {
    const entry = monthsOnTop.get(era.artistId) ?? { name: era.artistName, months: 0 };
    entry.months += era.months;
    monthsOnTop.set(era.artistId, entry);
  }
  const mostMonths = [...monthsOnTop.values()].sort((a, b) => b.months - a.months)[0];

  return (
    <div className="space-y-12">
      <InsightsHeader active="timeline" />

      {!years.length ? (
        <EmptyState icon={History} title="Nothing to look back on yet">
          Your years and eras show up here once you have some listening history.
        </EmptyState>
      ) : (
        <>
          <Section icon={CalendarRange} title="Year by year" description="How each year sounded, and how much of it there was.">
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {summaries.map(({ year, totals, artist, track }, index) => (
                <li
                  key={year}
                  className="flex animate-rise flex-col gap-4 rounded-2xl bg-surface p-4"
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  <div className="space-y-2">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-[26px] leading-none font-semibold tracking-tight tabular-nums">{year}</p>
                      <Link
                        href={`/wrapped/${year}`}
                        className="group inline-flex items-center gap-0.5 text-sm text-muted transition hover:text-foreground"
                      >
                        Wrapped
                        <ChevronRight className="size-4 transition group-hover:translate-x-0.5" />
                      </Link>
                    </div>
                    <p className="text-sm text-muted tabular-nums">
                      {formatMinutes(totals.msPlayed)} min · {formatNumber(totals.streams)} plays
                    </p>
                    <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                      <div
                        className="h-full origin-left animate-grow-x rounded-full bg-accent"
                        style={{ width: `${(totals.msPlayed / loudest) * 100}%`, animationDelay: `${150 + index * 60}ms` }}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    {artist && (
                      <Link href={`/artist/${artist.id}`} className="-mx-1 flex items-center gap-3 rounded-xl p-1 transition hover:bg-surface-2">
                        <span className="w-10 shrink-0">
                          <Cover src={artist.imageUrl} size={40} rounded label={artist.name} />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-xs text-subtle">Top artist</span>
                          <span className="block truncate font-medium">{artist.name}</span>
                        </span>
                      </Link>
                    )}
                    {track && (
                      <Link href={`/track/${track.id}`} className="-mx-1 flex items-center gap-3 rounded-xl p-1 transition hover:bg-surface-2">
                        <span className="w-10 shrink-0">
                          <Cover src={track.imageUrl} size={40} label={track.name} />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-xs text-subtle">Top track</span>
                          <span className="block truncate font-medium">{track.name}</span>
                        </span>
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Section>

          {eras.length > 0 && (
            <Section
              icon={Waypoints}
              title="Your eras"
              description="The artist you played most each month. Months in a row with the same artist make an era."
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <StatCard icon={Layers} compact label="Eras so far" value={formatNumber(eras.length)} />
                {longest && (
                  <StatCard
                    icon={Waypoints}
                    compact
                    index={1}
                    label="Longest era"
                    value={longest.artistName}
                    detail={monthCount(longest.months)}
                  />
                )}
                {mostMonths && (
                  <StatCard
                    icon={Crown}
                    compact
                    index={2}
                    label="Most months on top"
                    value={mostMonths.name}
                    detail={monthCount(mostMonths.months)}
                  />
                )}
              </div>
              <ol className="relative space-y-1 before:absolute before:top-4 before:bottom-4 before:left-[27px] before:w-px before:bg-border">
                {eras.map((era, index) => (
                  <li key={era.from} className="animate-rise" style={{ animationDelay: `${Math.min(index, 15) * 30}ms` }}>
                    <Link
                      href={`/artist/${era.artistId}`}
                      className="relative flex items-center gap-4 rounded-2xl p-2 transition hover:bg-surface"
                    >
                      <span className="w-10 shrink-0 ring-4 ring-background rounded-full">
                        <Cover src={era.imageUrl} size={40} rounded label={era.artistName} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{era.artistName}</span>
                        <span className="block text-sm text-muted">{eraDates(era)}</span>
                      </span>
                      <span className="shrink-0 text-right text-sm tabular-nums">
                        <span className="block font-medium">{monthCount(era.months)}</span>
                        <span className="block text-subtle">
                          {formatNumber(era.plays)} plays · {era.share}%
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </Section>
          )}
        </>
      )}
    </div>
  );
}
