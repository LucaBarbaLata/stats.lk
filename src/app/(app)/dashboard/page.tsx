import { CalendarDays, CalendarHeart, ChevronRight, Gift, History, Mic2, Share2, Tags, Trophy, Upload, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Cover } from "@/components/cover";
import { ImportProgressBanner } from "@/components/import-progress";
import { LiveTime } from "@/components/live-time";
import { MyNowPlaying } from "@/components/now-playing";
import { buttonClass, EmptyState, IconChip, LiveBadge, Notice, PageHeader, ProgressBar, Section } from "@/components/ui";
import { addDays, formatDay, today } from "@/lib/dates";
import { appTimezone } from "@/lib/env";
import { formatMinutes, formatNumber, formatRelative } from "@/lib/format";
import { getOnThisDay } from "@/lib/history";
import { getImportProgress } from "@/lib/import/progress";
import { levelFor } from "@/lib/levels";
import { PRESETS } from "@/lib/ranges";
import { requireUser } from "@/lib/session";
import { getNowPlaying } from "@/lib/social";
import { getDailyMinutes, getListeningTotals, getRecentStreams, getTopArtists, getTopGenres } from "@/lib/stats";

export const metadata: Metadata = { title: "Overview" };

const LAST_4_WEEKS = PRESETS[0];

function greeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: appTimezone() }).format(new Date()),
  );
  if (hour < 5) return "Late night";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage() {
  const user = await requireUser();
  const [totals, topArtists, topGenres, recent, listening, importProgress, onThisDay, daily] = await Promise.all([
    getListeningTotals(user.id),
    getTopArtists(user.id, LAST_4_WEEKS, "minutes", 5),
    getTopGenres(user.id, LAST_4_WEEKS, "minutes", 8),
    getRecentStreams(user.id, 10),
    getNowPlaying(user.id, [user.id]),
    getImportProgress(user.id),
    getOnThisDay(user.id, 3),
    getDailyMinutes(user.id, 15),
  ]);
  const todayDay = today();
  const year = todayDay.slice(0, 4);
  const timeZone = appTimezone();
  const level = levelFor(totals.msTotal / 60_000);

  // The last 7 days, oldest first, and the 7 before them for the trend
  const minutesOn = new Map(daily.map((day) => [day.key, day.msPlayed / 60_000]));
  const days = (from: number) =>
    Array.from({ length: 7 }, (_, index) => {
      const day = addDays(todayDay, from + index);
      return { day, minutes: minutesOn.get(day) ?? 0 };
    });
  const sum = (list: { minutes: number }[]) => list.reduce((total, day) => total + day.minutes, 0);
  const week = days(-6);
  const weekMinutes = sum(week);
  const previousMinutes = sum(days(-13));
  const change = previousMinutes > 0 ? Math.round(((weekMinutes - previousMinutes) / previousMinutes) * 100) : null;
  const busiest = Math.max(1, ...week.map((day) => day.minutes));

  return (
    <div className="space-y-8">
      <PageHeader
        title={`${greeting()}, ${user.displayName}`}
        description={
          totals.msToday > 0
            ? `${formatMinutes(totals.msToday)} minutes of music so far today.`
            : "Nothing played yet today."
        }
      />

      {importProgress.plays > 0 && !importProgress.done && <ImportProgressBanner initial={importProgress} />}

      {totals.importedStreams === 0 && (
        <Notice
          icon={History}
          title={`Your stats start with the ${formatNumber(totals.streams)} plays we've saved so far`}
          action={
            <Link href="/guide" className={buttonClass("primary", "sm")}>
              Get your full history
            </Link>
          }
        >
          Spotify only lets us see your last 50 plays. Import your history once and every stat goes back
          to the day you made your account.
        </Notice>
      )}

      <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-12">
        <div className="min-w-0 space-y-11">
          <MyNowPlaying userId={user.id} initial={listening} />

          <Section icon={Mic2} title="Top artists" description="Last 4 weeks, by minutes" href="/top/artists?range=4w&sort=minutes">
            {topArtists.length ? (
              <ol className="-mx-4 flex snap-x scroll-px-4 gap-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-5 sm:gap-5 sm:overflow-visible sm:px-0">
                {topArtists.map((artist, index) => (
                  <li key={artist.id} className="w-28 shrink-0 animate-pop snap-start sm:w-auto" style={{ animationDelay: `${index * 70}ms` }}>
                    <Link href={`/artist/${artist.id}`} className="group block space-y-2.5">
                      <div className="relative transition duration-300 group-hover:-translate-y-1">
                        <Cover src={artist.imageUrl} size={140} rounded label={artist.name} />
                        <span className="absolute top-0 left-0 flex size-6 items-center justify-center rounded-full bg-background/85 text-xs font-semibold tabular-nums backdrop-blur">
                          {index + 1}
                        </span>
                      </div>
                      <div className="text-center">
                        <p className="line-clamp-2 leading-snug font-medium text-balance">{artist.name}</p>
                        <p className="text-sm text-muted tabular-nums">{formatMinutes(artist.msPlayed)} min</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState icon={Mic2} title="No artists yet">
                Play something on Spotify. It shows up here within a minute or two.
              </EmptyState>
            )}
          </Section>

          <Section icon={History} title="Recently played" badge={<LiveBadge />}>
            {recent.length ? (
              <ul className="-mx-2 divide-y divide-border/70">
                {recent.map((stream, index) => (
                  <li key={stream.id} className="animate-rise py-1" style={{ animationDelay: `${Math.min(index, 10) * 35}ms` }}>
                    <Link
                      href={`/track/${stream.trackId}`}
                      className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition hover:bg-surface"
                    >
                      <Cover src={stream.albumImageUrl} size={48} label={stream.trackName} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{stream.trackName}</p>
                        <p className="truncate text-sm text-muted">{stream.artistNames}</p>
                      </div>
                      <LiveTime iso={stream.playedAt.toISOString()} initial={formatRelative(stream.playedAt)} timeZone={timeZone} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={History} title="Nothing played yet">
                Your plays show up here a minute or two after you listen.
              </EmptyState>
            )}
          </Section>
        </div>

        {/* Everything secondary lives in this one panel, split by lines */}
        <aside className="animate-rise divide-y divide-border/70 rounded-3xl bg-surface px-5" style={{ animationDelay: "120ms" }}>
          <RailSection icon={CalendarDays} title="Last 7 days" aside={change !== null && <Trend percent={change} />}>
            <p className="text-[32px] leading-none font-semibold tracking-tight tabular-nums">
              {formatNumber(Math.round(weekMinutes))} <span className="text-lg font-medium text-muted">min</span>
            </p>
            <ol className="flex h-20 gap-1.5 pt-1" aria-label="Minutes per day">
              {week.map(({ day, minutes }, index) => (
                <li key={day} className="flex min-w-0 flex-1 flex-col items-stretch gap-1">
                  <span className="flex flex-1 items-end" title={`${formatDay(day, { weekday: "long", year: undefined })}: ${formatNumber(Math.round(minutes))} min`}>
                    <span
                      className={`w-full origin-bottom animate-grow-y rounded-[4px] ${minutes === busiest ? "bg-accent" : "bg-surface-3"}`}
                      style={{ height: `${(minutes / busiest) * 100}%`, minHeight: minutes > 0 ? 3 : 0, animationDelay: `${200 + index * 40}ms` }}
                    />
                  </span>
                  <span className="text-center text-[11px] leading-none text-subtle">
                    {formatDay(day, { weekday: "narrow", month: undefined, day: undefined, year: undefined })}
                  </span>
                </li>
              ))}
            </ol>
          </RailSection>

          <Link href="/insights/trophies" aria-label="Your level and trophies" className="group block">
            <RailSection icon={Trophy} title={`Level ${level.level}`} aside={<ChevronRight className="size-4 text-subtle transition group-hover:translate-x-0.5" />}>
              <p className="text-lg leading-tight font-semibold">{level.title}</p>
              <ProgressBar value={level.progress} label="Progress to the next level" />
              <p className="text-sm text-muted">
                {level.nextLevelAt === null
                  ? "The top level. Nothing left to prove."
                  : `${formatNumber(Math.ceil(level.nextLevelAt - level.minutes))} minutes to level ${level.level + 1}`}
              </p>
            </RailSection>
          </Link>

          {onThisDay.length > 0 && (
            <RailSection icon={CalendarHeart} title="On this day">
              <ul className="-mx-2 space-y-0.5">
                {onThisDay.map((day) => {
                  const yearsAgo = Number(year) - day.year;
                  return (
                    <li key={day.year}>
                      <Link href={`/track/${day.trackId}`} className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition hover:bg-surface-2">
                        <Cover src={day.imageUrl} size={44} label={day.trackName} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs text-accent">
                            {yearsAgo === 1 ? "A year ago" : `${yearsAgo} years ago`}
                          </span>
                          <span className="block truncate font-medium">{day.trackName}</span>
                          <span className="block truncate text-sm text-muted">
                            {day.artistNames}, {formatNumber(day.plays)} {day.plays === 1 ? "play" : "plays"}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </RailSection>
          )}

          {topGenres.length > 0 && (
            <RailSection
              icon={Tags}
              title="Your genres"
              aside={
                <Link href="/top/genres?range=4w&sort=minutes" className="text-sm text-muted transition hover:text-foreground">
                  See all
                </Link>
              }
            >
              <ul className="flex flex-wrap gap-2">
                {topGenres.map((genre, index) => (
                  <li
                    key={genre.id}
                    className={`rounded-full px-3 py-1 text-sm first-letter:uppercase ${index === 0 ? "bg-accent-fill/20 text-foreground ring-1 ring-accent/30 ring-inset" : "bg-surface-2 text-muted"}`}
                  >
                    {genre.name}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-subtle">
                <a href="https://www.last.fm" target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
                  Genres from Last.fm
                </a>
              </p>
            </RailSection>
          )}

          <nav aria-label="More" className="-mx-2 space-y-0.5 py-3">
            <Shortcut href={`/wrapped/${year}`} icon={Gift} title={`Your ${year} Wrapped`} />
            <Shortcut href="/share" icon={Share2} title="Share your stats" />
            <Shortcut href="/import" icon={Upload} title="Import history" />
          </nav>
        </aside>
      </div>

      {user.syncError && (
        <p className="text-sm text-subtle">Last sync with Spotify failed: {user.syncError}</p>
      )}
    </div>
  );
}

// One block of the side panel
function RailSection({
  icon: Icon,
  title,
  aside,
  children,
}: {
  icon: LucideIcon;
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3 py-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-medium text-muted">
          <Icon className="size-4 text-accent" />
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Trend({ percent }: { percent: number }) {
  if (percent === 0) return <span className="text-sm text-muted">Same as before</span>;
  return (
    <span className={`text-sm font-medium tabular-nums ${percent > 0 ? "text-accent" : "text-muted"}`}>
      {percent > 0 ? "Up" : "Down"} {Math.abs(percent)}%
    </span>
  );
}

function Shortcut({ href, icon, title }: { href: string; icon: LucideIcon; title: string }) {
  return (
    <Link href={href} className="group flex items-center gap-3 rounded-xl px-2 py-1.5 transition hover:bg-surface-2">
      <IconChip icon={icon} size="sm" />
      <span className="min-w-0 flex-1 truncate font-medium">{title}</span>
      <ChevronRight className="size-4 text-subtle transition group-hover:translate-x-0.5 group-hover:text-foreground" />
    </Link>
  );
}
