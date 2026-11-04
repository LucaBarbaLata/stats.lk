import { Gift, Headphones, ListMusic, Mic2, Share2, Tags } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Cover } from "@/components/cover";
import { StatCard } from "@/components/stat-card";
import { TopList } from "@/components/top-list";
import { buttonClass, EmptyState, PageHeader, Section, Segmented } from "@/components/ui";
import { computeStreaks, formatDay, today } from "@/lib/dates";
import { formatMinutes, formatNumber } from "@/lib/format";
import { yearRange } from "@/lib/periods";
import { hourSeries, monthSeries, weekdaySeries, type ChartPoint } from "@/lib/series";
import { requireUser } from "@/lib/session";
import {
  getActivity,
  getDailyTotals,
  getListeningYears,
  getNewArtists,
  getPeriodTotals,
  getTopArtists,
  getTopGenres,
  getTopTracks,
} from "@/lib/stats";

const busiest = (points: ChartPoint[]) =>
  points.reduce((best, point) => (point.minutes > best.minutes ? point : best), points[0]);

export async function generateMetadata({ params }: PageProps<"/wrapped/[year]">): Promise<Metadata> {
  return { title: `Wrapped ${(await params).year}` };
}

export default async function WrappedPage({ params }: PageProps<"/wrapped/[year]">) {
  const { year: rawYear } = await params;
  if (!/^\d{4}$/.test(rawYear)) notFound();
  const year = Number(rawYear);
  const user = await requireUser();
  const range = yearRange(year);
  const todayDay = today();
  const isCurrentYear = todayDay.startsWith(rawYear);

  const [years, totals, artists, tracks, genres, newArtists, months, weekdays, hours, daily] = await Promise.all([
    getListeningYears(user.id),
    getPeriodTotals(user.id, range),
    getTopArtists(user.id, range, "minutes", 5),
    getTopTracks(user.id, range, "plays", 5),
    getTopGenres(user.id, range, "minutes", 5),
    getNewArtists(user.id, range, 1),
    getActivity(user.id, "month", range),
    getActivity(user.id, "weekday", range),
    getActivity(user.id, "hour", range),
    getDailyTotals(user.id, range),
  ]);

  const yearPicker = (
    <Segmented
      label="Year"
      items={years.map((option) => ({ href: `/wrapped/${option}`, label: String(option), active: option === year }))}
    />
  );
  const shareButton = (
    <Link href={`/share?card=wrapped&year=${year}`} className={buttonClass("secondary", "sm")}>
      <Share2 className="size-4" /> Share
    </Link>
  );

  if (!totals.streams) {
    return (
      <div className="space-y-8">
        <PageHeader title={`Wrapped ${year}`} />
        {years.length > 0 && yearPicker}
        <EmptyState
          icon={Gift}
          title={`No plays in ${year}`}
          action={
            <Link href="/guide" className={buttonClass("primary", "sm")}>
              Import your history
            </Link>
          }
        >
          Import your Spotify history to see your Wrapped for past years.
        </EmptyState>
      </div>
    );
  }

  const [topArtist, ...otherArtists] = artists;
  const monthPoints = monthSeries(months, isCurrentYear ? todayDay.slice(0, 7) : `${year}-12`, `${year}-01`);
  const recordDay = daily.reduce((best, day) => (day.msPlayed > best.msPlayed ? day : best), daily[0]);
  const streak = computeStreaks(daily.map((day) => day.key), todayDay).longest;
  const minutes = totals.msPlayed / 60_000;

  return (
    <div className="space-y-12">
      <div className="space-y-6">
        <PageHeader title="Wrapped" actions={shareButton} />
        {yearPicker}
      </div>

      <section className="relative isolate overflow-hidden rounded-3xl bg-surface px-6 py-12 sm:px-10 sm:py-16">
        {topArtist?.imageUrl && (
          <Image
            src={topArtist.imageUrl}
            alt=""
            fill
            unoptimized
            aria-hidden
            className="-z-10 scale-125 object-cover opacity-25 blur-3xl saturate-150"
          />
        )}
        <p className="font-medium text-accent">Your {year} in music{isCurrentYear && " so far"}</p>
        <p className="mt-3 text-[64px] leading-none font-semibold tracking-[-0.04em] sm:text-[96px]">
          {formatMinutes(totals.msPlayed)}
        </p>
        <p className="mt-3 text-lg text-muted">
          minutes listened. That&apos;s {formatNumber(Math.round((minutes / 1440) * 10) / 10)} days of
          music.
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Plays" value={formatNumber(totals.streams)} />
        <StatCard label="Different artists" value={formatNumber(totals.artists)} />
        <StatCard label="Different tracks" value={formatNumber(totals.tracks)} />
        <StatCard label="New artists" value={formatNumber(newArtists[0]?.total ?? 0)} />
      </section>

      {topArtist && (
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Link
            href={`/artist/${topArtist.id}`}
            className="flex flex-col items-start gap-5 rounded-3xl bg-surface p-6 transition hover:bg-surface-2 sm:flex-row sm:items-center"
          >
            <div className="w-36 shrink-0 shadow-2xl shadow-black/50" style={{ borderRadius: "9999px" }}>
              <Cover src={topArtist.imageUrl} size={144} rounded label={topArtist.name} />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium text-accent">Your top artist</p>
              <p className="text-3xl font-semibold tracking-tight break-words">{topArtist.name}</p>
              <p className="text-muted">
                {formatMinutes(topArtist.msPlayed)} minutes over {formatNumber(topArtist.streams)} plays
              </p>
            </div>
          </Link>
          {otherArtists.length > 0 && (
            <Section icon={Mic2} title="Then came">
              <ol className="-mx-2">
                {otherArtists.map((artist, index) => (
                  <li key={artist.id}>
                    <Link href={`/artist/${artist.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-surface">
                      <span className="w-6 text-right text-sm font-medium text-subtle tabular-nums">{index + 2}</span>
                      <Cover src={artist.imageUrl} size={48} rounded label={artist.name} />
                      <span className="min-w-0 flex-1 truncate font-medium">{artist.name}</span>
                      <span className="text-sm text-subtle tabular-nums">{formatMinutes(artist.msPlayed)} min</span>
                    </Link>
                  </li>
                ))}
              </ol>
            </Section>
          )}
        </section>
      )}

      <Section icon={ListMusic} title="Your top tracks">
        <TopList items={tracks.map((track) => ({ ...track, href: `/track/${track.id}` }))} />
      </Section>

      {genres.length > 0 && (
        <Section icon={Tags} title="Your top genres">
          <ol className="flex flex-wrap gap-2">
            {genres.map((genre, index) => (
              <li
                key={genre.id}
                className={`rounded-full px-4 py-1.5 first-letter:uppercase ${index === 0 ? "bg-accent-fill/20 text-lg font-medium ring-1 ring-accent/30 ring-inset" : "bg-surface text-muted"}`}
              >
                {genre.name}
              </li>
            ))}
          </ol>
        </Section>
      )}

      <Section icon={Headphones} title="How you listened">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            compact
            label="Busiest month"
            value={busiest(monthPoints).fullLabel}
            detail={`${formatNumber(busiest(monthPoints).minutes)} minutes`}
          />
          <StatCard
            compact
            label="Favourite day"
            value={`${busiest(weekdaySeries(weekdays)).fullLabel}s`}
            detail={`${formatNumber(busiest(weekdaySeries(weekdays)).minutes)} minutes in total`}
          />
          <StatCard
            compact
            label="Favourite hour"
            value={busiest(hourSeries(hours)).fullLabel}
            detail={`${formatNumber(busiest(hourSeries(hours)).plays)} plays at that hour`}
          />
          <StatCard
            compact
            label="Record day"
            value={formatDay(recordDay.key)}
            detail={`${formatMinutes(recordDay.msPlayed)} minutes in one day`}
          />
          {streak && (
            <StatCard
              compact
              label="Longest streak"
              value={`${formatNumber(streak.length)} days in a row`}
              detail={`${formatDay(streak.start, { year: undefined })} – ${formatDay(streak.end)}`}
            />
          )}
        </div>
      </Section>
    </div>
  );
}
