import { CalendarDays, ChartColumn, Flame, Trophy } from "lucide-react";
import type { Metadata } from "next";
import { ColumnChart } from "@/components/column-chart";
import { Heatmap, type HeatmapDay } from "@/components/heatmap";
import { RangeFilter } from "@/components/range-filter";
import { StatCard } from "@/components/stat-card";
import { IconChip, PageHeader, Section } from "@/components/ui";
import { addDays, computeStreaks, daysBetween, formatDay, startOfWeek, today } from "@/lib/dates";
import { formatNumber } from "@/lib/format";
import { parseRange } from "@/lib/ranges";
import {
  DAYPARTS,
  daypartOf,
  hourSeries,
  monthSeries,
  peakOf,
  shareOf,
  WEEKEND_COLOR,
  weekdayOrder,
  weekdaySeries,
} from "@/lib/series";
import { requireUser } from "@/lib/session";
import { getActivity, getDailyMinutes, getListeningDays } from "@/lib/stats";

const HEATMAP_WEEKS = 53;

export const metadata: Metadata = { title: "Activity" };

export default async function ActivityPage({ searchParams }: PageProps<"/activity">) {
  const query = await searchParams;
  const user = await requireUser();
  const range = parseRange(query, "all");

  const todayDay = today();
  // Whole weeks from the user's first day of the week, ending with the current week
  const lastDay = addDays(startOfWeek(todayDay, user.weekStart), 6);
  const firstDay = addDays(lastDay, -HEATMAP_WEEKS * 7 + 1);

  const [daily, listeningDays, hours, weekdays, months] = await Promise.all([
    getDailyMinutes(user.id, daysBetween(firstDay, todayDay) + 1),
    getListeningDays(user.id),
    getActivity(user.id, "hour", range),
    getActivity(user.id, "weekday", range),
    getActivity(user.id, "month", range),
  ]);

  const minutesByDay = new Map(daily.map((day) => [day.key, Math.round(day.msPlayed / 60_000)]));
  const heatmapDays: HeatmapDay[] = [];
  for (let day = firstDay; day <= lastDay; day = addDays(day, 1)) {
    heatmapDays.push({
      date: day,
      label: formatDay(day, { weekday: "short" }),
      minutes: day > todayDay ? null : (minutesByDay.get(day) ?? 0),
    });
  }
  // Label a week's column with its month when the month starts in that week
  const monthLabels = [];
  for (let week = 0; week < HEATMAP_WEEKS; week++) {
    const firstOfWeek = heatmapDays[week * 7].date;
    if (Number(firstOfWeek.slice(8)) <= 7) {
      monthLabels.push({ column: week, label: formatDay(firstOfWeek, { month: "short", day: undefined, year: undefined }) });
    }
  }

  const streaks = computeStreaks(listeningDays, todayDay);
  const monthsTo = range.key === "custom" ? range.to.slice(0, 7) : todayDay.slice(0, 7);
  const monthly = monthSeries(months, monthsTo);
  const hourly = hourSeries(hours);
  const daily7 = weekdaySeries(weekdays, user.weekStart);
  const weekOrder = weekdayOrder(user.weekStart);
  const isWeekend = (index: number) => weekOrder[index] >= 6;

  // One sentence per chart, so the takeaway doesn't need squinting
  const peakHour = peakOf(hourly);
  const parts = DAYPARTS.map((part) => ({ ...part, share: shareOf(hourly, (_, hour) => daypartOf(hour) === part) }));
  const topPart = parts.reduce((best, part) => (part.share > best.share ? part : best));
  const hourSummary = peakHour
    ? `You listen most around ${peakHour.label}:00. ${topPart.label}s are ${topPart.share}% of your listening.`
    : undefined;
  const peakDay = peakOf(daily7);
  const weekendShare = shareOf(daily7, (_, index) => isWeekend(index));
  const daySummary = peakDay
    ? `${peakDay.fullLabel} is your biggest day. ${weekendShare > 0 ? `Weekends are ${weekendShare}% of your listening.` : "No weekend plays yet."}`
    : undefined;
  const peakMonth = peakOf(monthly);
  const monthSummary = peakMonth
    ? `Your busiest month was ${peakMonth.fullLabel}, with ${formatNumber(peakMonth.minutes)} minutes.`
    : undefined;

  return (
    <div className="space-y-12">
      <PageHeader title="Activity" description="When you listen, how often, and how long you keep it going." />

      <section className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard
            icon={Flame}
            label="Current streak"
            value={`${formatNumber(streaks.current)} ${streaks.current === 1 ? "day" : "days"}`}
            detail="Days in a row with at least one play"
          />
          <StatCard
            icon={Trophy}
            index={1}
            label="Longest streak"
            value={`${formatNumber(streaks.longest?.length ?? 0)} ${streaks.longest?.length === 1 ? "day" : "days"}`}
            detail={streaks.longest ? `${formatDay(streaks.longest.start, { year: undefined })} – ${formatDay(streaks.longest.end)}` : undefined}
          />
          <StatCard
            icon={CalendarDays}
            index={2}
            label="Days with music"
            value={formatNumber(listeningDays.length)}
            detail={listeningDays[0] ? `Since ${formatDay(listeningDays[0])}` : undefined}
          />
        </div>
        <div className="space-y-4 rounded-2xl bg-surface p-5">
          <h2 className="flex items-center gap-3 font-medium">
            <IconChip icon={CalendarDays} />
            Minutes per day, last 12 months
          </h2>
          <Heatmap days={heatmapDays} monthLabels={monthLabels} />
        </div>
      </section>

      <Section icon={ChartColumn} title="Listening patterns" description="Everything below follows the period you pick.">
        <RangeFilter path="/activity" range={range} />
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="rounded-2xl bg-surface p-5">
            <ColumnChart
              title="Hour of the day"
              summary={hourSummary}
              data={hourly}
              colors={hourly.map((_, hour) => daypartOf(hour).color)}
              legend={DAYPARTS.map((part) => ({ label: part.label, color: part.color }))}
              labelEvery={3}
            />
          </div>
          <div className="rounded-2xl bg-surface p-5">
            <ColumnChart
              title="Day of the week"
              summary={daySummary}
              data={daily7}
              colors={daily7.map((_, index) => (isWeekend(index) ? WEEKEND_COLOR : "var(--accent)"))}
              legend={[
                { label: "Weekdays", color: "var(--accent)" },
                { label: "Weekend", color: WEEKEND_COLOR },
              ]}
            />
          </div>
        </div>
        <div className="rounded-2xl bg-surface p-5">
          <ColumnChart
            title="Minutes per month"
            summary={monthSummary}
            data={monthly}
            labelEvery={Math.max(1, Math.ceil(monthly.length / 12))}
          />
        </div>
      </Section>
    </div>
  );
}
