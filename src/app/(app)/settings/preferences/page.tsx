import { ArrowDownWideNarrow, CalendarDays, ChartColumn, Earth, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Select } from "@/components/select";
import { SettingsForm } from "@/components/settings-form";
import { IconChip } from "@/components/ui";
import { SORTS, WEEK_STARTS } from "@/lib/preferences";
import { PRESETS } from "@/lib/ranges";
import { requireUser } from "@/lib/session";
import { savePreferences } from "../actions";

export const metadata: Metadata = { title: "Preferences" };

const DEFAULT_TIMEZONE = process.env.APP_TIMEZONE ?? "Europe/Bucharest";

// "GMT+2" for a time zone, right now
function offsetOf(zone: string): string {
  const part = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "shortOffset" })
    .formatToParts(new Date())
    .find((p) => p.type === "timeZoneName");
  return part?.value ?? "";
}

function Row({ id, icon, label, hint, children }: { id: string; icon: LucideIcon; label: string; hint: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-4 py-5 sm:grid-cols-[minmax(0,1fr)_260px] sm:items-center sm:gap-8">
      <div className="flex gap-4">
        <IconChip icon={icon} size="lg" />
        <div className="min-w-0 space-y-1">
          <p id={`${id}-label`} className="font-medium">
            {label}
          </p>
          <p className="text-sm text-pretty text-muted">{hint}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

export default async function PreferencesPage() {
  const user = await requireUser();
  const timeZones = [
    { value: "", label: `Default (${DEFAULT_TIMEZONE.replace(/_/g, " ")})`, hint: offsetOf(DEFAULT_TIMEZONE) },
    ...Intl.supportedValuesOf("timeZone").map((zone) => ({ value: zone, label: zone.replace(/_/g, " "), hint: offsetOf(zone) })),
  ];

  return (
    <SettingsForm action={savePreferences} title="Preferences" description="How your stats are counted and shown.">
      <div className="divide-y divide-border/60 rounded-3xl bg-surface px-5 sm:px-6">
        <Row
          id="timezone"
          icon={Earth}
          label="Time zone"
          hint="Decides when your days start and end: minutes today, streaks, the heatmap and hours of the day."
        >
          <Select id="timezone" labelledBy="timezone-label" name="timezone" options={timeZones} defaultValue={user.timezone ?? ""} searchable />
        </Row>
        <Row id="week-start" icon={CalendarDays} label="Weeks start on" hint="For the heatmap, the weekday chart and “This week” in Compare.">
          <Select
            id="week-start"
            labelledBy="week-start-label"
            name="weekStart"
            options={WEEK_STARTS.map((option) => ({ value: String(option.value), label: option.label }))}
            defaultValue={String(user.weekStart)}
          />
        </Row>
        <Row id="default-range" icon={ChartColumn} label="Top lists open on" hint="The period your top tracks, artists and albums show first.">
          <Select
            id="default-range"
            labelledBy="default-range-label"
            name="defaultRange"
            options={PRESETS.map((preset) => ({ value: preset.key, label: preset.label }))}
            defaultValue={user.defaultRange}
          />
        </Row>
        <Row id="default-sort" icon={ArrowDownWideNarrow} label="Top lists sorted" hint="Rank by how often you played something, or for how long.">
          <Select
            id="default-sort"
            labelledBy="default-sort-label"
            name="defaultSort"
            options={SORTS.map((option) => ({ value: option.value, label: option.label }))}
            defaultValue={user.defaultSort}
          />
        </Row>
      </div>
    </SettingsForm>
  );
}
