import type { Metadata } from "next";
import { CompareList } from "@/components/compare-list";
import { StatCard } from "@/components/stat-card";
import { InsightsHeader } from "@/components/sub-nav";
import { Segmented } from "@/components/ui";
import { today } from "@/lib/dates";
import { formatMinutes, formatNumber } from "@/lib/format";
import { comparePeriods, PERIOD_LABELS, type PeriodKind } from "@/lib/periods";
import { requireUser } from "@/lib/session";
import { getNewArtists, getPeriodTotals, getTopArtists, getTopTracks } from "@/lib/stats";

const KINDS = Object.keys(PERIOD_LABELS) as PeriodKind[];

export const metadata: Metadata = { title: "Compare" };

// "↑ 12% vs 1,234" against the previous period
function versus(current: number, previous: number, format: (value: number) => string): string {
  if (previous === 0) return current > 0 ? "Nothing in the previous period" : "Same as before";
  const percent = Math.round(((current - previous) / previous) * 100);
  const arrow = percent > 0 ? "↑" : percent < 0 ? "↓" : "=";
  return `${arrow} ${Math.abs(percent)}% vs ${format(previous)}`;
}

export default async function ComparePage({ searchParams }: PageProps<"/insights/compare">) {
  const query = await searchParams;
  const user = await requireUser();
  const kind = KINDS.find((k) => k === query.period) ?? "month";
  const { current, previous } = comparePeriods(kind, today(), user.weekStart);

  const [now, before, artistsNow, artistsBefore, tracksNow, tracksBefore, newNow, newBefore] = await Promise.all([
    getPeriodTotals(user.id, current),
    getPeriodTotals(user.id, previous),
    getTopArtists(user.id, current, "minutes", 10),
    getTopArtists(user.id, previous, "minutes", 50),
    getTopTracks(user.id, current, "minutes", 10),
    getTopTracks(user.id, previous, "minutes", 50),
    getNewArtists(user.id, current, 1),
    getNewArtists(user.id, previous, 1),
  ]);
  const newArtistsNow = newNow[0]?.total ?? 0;
  const newArtistsBefore = newBefore[0]?.total ?? 0;

  return (
    <div className="space-y-10">
      <InsightsHeader active="compare" />

      <div className="space-y-3">
        <Segmented
          label="Period"
          items={KINDS.map((option) => ({
            href: `/insights/compare?period=${option}`,
            label: PERIOD_LABELS[option],
            active: option === kind,
          }))}
        />
        <p className="text-sm text-muted">
          {current.label} compared with the same days before, {previous.label}.
        </p>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Minutes"
          value={formatMinutes(now.msPlayed)}
          detail={versus(now.msPlayed, before.msPlayed, formatMinutes)}
        />
        <StatCard label="Plays" value={formatNumber(now.streams)} detail={versus(now.streams, before.streams, formatNumber)} />
        <StatCard
          label="Different artists"
          value={formatNumber(now.artists)}
          detail={versus(now.artists, before.artists, formatNumber)}
        />
        <StatCard
          label="New artists"
          value={formatNumber(newArtistsNow)}
          detail={versus(newArtistsNow, newArtistsBefore, formatNumber)}
        />
      </section>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
        <CompareList title="Top artists" items={artistsNow} previous={artistsBefore} hrefPrefix="/artist/" rounded />
        <CompareList title="Top tracks" items={tracksNow} previous={tracksBefore} hrefPrefix="/track/" />
      </div>
    </div>
  );
}
