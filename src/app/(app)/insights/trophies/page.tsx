import { Compass, Flag, Flame, Heart, Trophy, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Cover } from "@/components/cover";
import { StatCard } from "@/components/stat-card";
import { InsightsHeader } from "@/components/sub-nav";
import { LevelCard, TrophyCard } from "@/components/trophies";
import { EmptyState, Section } from "@/components/ui";
import { formatDate, formatDay } from "@/lib/dates";
import { formatNumber } from "@/lib/format";
import { levelFor } from "@/lib/levels";
import {
  ARTIST_PLAYS,
  artistsLadder,
  minutesLadder,
  playsLadder,
  streakLadder,
  TRACK_PLAYS,
  type LadderKind,
} from "@/lib/milestones";
import { CATEGORIES, evaluateTrophies } from "@/lib/trophies";
import { getTrophyMetrics } from "@/lib/trophy-metrics";
import { ALL_TIME } from "@/lib/ranges";
import { requireUser } from "@/lib/session";
import { getArtistDiscoveriesByDay, getDailyTotals, getListeningDays, getPlayMilestones } from "@/lib/stats";

const CATEGORY_ICONS = { habits: Flame, discovery: Compass, loyalty: Heart, social: Users };

export const metadata: Metadata = { title: "Trophies" };

const LADDER_TEXT: Record<LadderKind, { title: string; unit: (n: number) => string }> = {
  minutes: { title: "Minutes listened", unit: (n) => `${formatNumber(n)} minutes listened` },
  plays: { title: "Plays", unit: (n) => `${formatNumber(n)} plays` },
  artists: { title: "Artists discovered", unit: (n) => `${formatNumber(n)} artists discovered` },
  streak: { title: "Longest streak", unit: (n) => `${formatNumber(n)}-day streak` },
};

interface TimelineEntry {
  key: string;
  title: string;
  date: string;
  // YYYY-MM-DD, for sorting newest first
  sort: string;
  href?: string;
  imageUrl?: string | null;
  rounded?: boolean;
}

export default async function TrophiesPage() {
  const user = await requireUser();
  const [daily, listeningDays, discoveries, playMilestones, metrics] = await Promise.all([
    getDailyTotals(user.id, ALL_TIME),
    getListeningDays(user.id),
    getArtistDiscoveriesByDay(user.id),
    getPlayMilestones(user.id, ARTIST_PLAYS, TRACK_PLAYS, 40),
    getTrophyMetrics(user.id),
  ]);
  const level = levelFor(metrics.totalMinutes);
  const trophies = evaluateTrophies(metrics);
  const unlocked = trophies.filter((trophy) => trophy.tier > 0).length;
  const golds = trophies.filter((trophy) => trophy.tier === 3).length;

  const ladders = [minutesLadder(daily), playsLadder(daily), artistsLadder(discoveries), streakLadder(listeningDays)];

  const timeline: TimelineEntry[] = [
    ...ladders.flatMap((ladder) =>
      ladder.reached.map((step) => ({
        key: `${ladder.kind}-${step.threshold}`,
        title: LADDER_TEXT[ladder.kind].unit(step.threshold),
        date: formatDay(step.day),
        sort: step.day,
      })),
    ),
    ...playMilestones.map((milestone) => ({
      key: `${milestone.type}-${milestone.id}-${milestone.plays}`,
      title: `${formatNumber(milestone.plays)} plays of ${milestone.name}`,
      date: formatDate(new Date(milestone.reachedMs)),
      sort: new Date(milestone.reachedMs).toISOString().slice(0, 10),
      href: `/${milestone.type}/${milestone.id}`,
      imageUrl: milestone.imageUrl,
      rounded: milestone.type === "artist",
    })),
  ]
    .sort((a, b) => b.sort.localeCompare(a.sort));

  return (
    <div className="space-y-12">
      <InsightsHeader active="trophies" />

      <section className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <LevelCard level={level} />
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Trophies unlocked" value={`${unlocked} of ${trophies.length}`} />
          <StatCard label="Gold" value={formatNumber(golds)} detail="The highest tier" />
        </div>
      </section>

      {CATEGORIES.map((category) => (
        <Section key={category.key} icon={CATEGORY_ICONS[category.key]} title={category.label} description={category.description}>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {trophies
              .filter((trophy) => trophy.category === category.key)
              .map((trophy, index) => (
                <TrophyCard key={trophy.key} trophy={trophy} index={index} />
              ))}
          </ul>
        </Section>
      ))}

      <Section icon={Flag} title="Milestone history" description="Round numbers you've passed, newest first.">
        {timeline.length ? (
          <ol className="-mx-2">
            {timeline.map((entry) => {
              const content = (
                <>
                  {entry.imageUrl !== undefined ? (
                    <Cover src={entry.imageUrl} size={44} rounded={entry.rounded} label={entry.title} />
                  ) : (
                    <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-fill/20 text-accent">
                      <Trophy className="size-5" />
                    </span>
                  )}
                  <p className="min-w-0 flex-1 truncate font-medium">{entry.title}</p>
                  <span className="shrink-0 text-sm text-subtle">{entry.date}</span>
                </>
              );
              const rowClass = "flex items-center gap-3 rounded-xl px-2 py-2";
              return (
                <li key={entry.key}>
                  {entry.href ? (
                    <Link href={entry.href} className={`${rowClass} transition hover:bg-surface`}>
                      {content}
                    </Link>
                  ) : (
                    <div className={rowClass}>{content}</div>
                  )}
                </li>
              );
            })}
          </ol>
        ) : (
          <EmptyState icon={Trophy} title="No milestones yet">
            Your first one is 100 plays away at most.
          </EmptyState>
        )}
      </Section>
    </div>
  );
}
