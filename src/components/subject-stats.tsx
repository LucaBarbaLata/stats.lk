import { Headphones } from "lucide-react";
import { ColumnChart } from "@/components/column-chart";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/ui";
import { formatDate, formatDay, today } from "@/lib/dates";
import { formatMinutes, formatNumber } from "@/lib/format";
import { ALL_TIME } from "@/lib/ranges";
import { monthSeries } from "@/lib/series";
import { getActivity, getSubjectSummary, type Subject } from "@/lib/stats";

// The numbers every artist, track and album page shows: totals, first and
// favourite day, and minutes per month.
export async function SubjectStats({ userId, subject }: { userId: string; subject: Subject }) {
  const [summary, months] = await Promise.all([
    getSubjectSummary(userId, subject),
    getActivity(userId, "month", ALL_TIME, subject),
  ]);

  if (!summary.streams) {
    return (
      <EmptyState icon={Headphones} title="Not in your history yet">
        Once you play it on Spotify, your plays and minutes show up here.
      </EmptyState>
    );
  }

  const series = monthSeries(months, today().slice(0, 7));
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Plays" value={formatNumber(summary.streams)} />
        <StatCard label="Minutes" value={formatMinutes(summary.msPlayed)} />
        <StatCard
          label="First listened"
          value={summary.firstPlayedAt ? formatDate(summary.firstPlayedAt) : "–"}
          compact
        />
        <StatCard
          label="Most plays in a day"
          value={summary.topDay ? formatNumber(summary.topDay.streams) : "–"}
          detail={summary.topDay ? formatDay(summary.topDay.day) : undefined}
        />
      </div>
      <div className="rounded-2xl bg-surface p-5">
        <ColumnChart
          title="Minutes per month"
          data={series}
          labelEvery={Math.max(1, Math.ceil(series.length / 12))}
        />
      </div>
    </div>
  );
}
