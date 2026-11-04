import { CalendarRange } from "lucide-react";
import { buttonClass, Segmented } from "@/components/ui";
import { PRESETS, type Range } from "@/lib/ranges";

// The one filter row above a page's stats: range presets, a custom range,
// and extra query params (like the sort order) that links must keep.
export function RangeFilter({
  path,
  range,
  keep = {},
}: {
  path: string;
  range: Range;
  keep?: Record<string, string>;
}) {
  const extra = new URLSearchParams(keep).toString();
  const href = (query: string) => `${path}?${query}${extra ? `&${extra}` : ""}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Segmented
        label="Time range"
        items={PRESETS.map((preset) => ({
          href: href(`range=${preset.key}`),
          label: preset.label,
          active: range.key === preset.key,
        }))}
      />
      <details className="group relative">
        <summary
          className={`${buttonClass(range.key === "custom" ? "primary" : "ghost", "sm")} h-9 cursor-pointer list-none [&::-webkit-details-marker]:hidden`}
        >
          <CalendarRange className="size-4" />
          {range.key === "custom" ? range.label : "Custom"}
        </summary>
        <form
          action={path}
          className="absolute left-0 z-10 mt-2 flex w-max flex-col gap-3 rounded-2xl border border-border bg-surface-2 p-4 shadow-2xl shadow-black/40 sm:flex-row sm:items-end"
        >
          {Object.entries(keep).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <label className="flex flex-col gap-1.5 text-sm text-muted">
            From
            <input
              type="date"
              name="from"
              required
              defaultValue={range.key === "custom" ? range.from : undefined}
              className="h-9 rounded-lg bg-surface-3 px-3 text-foreground"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-muted">
            To
            <input
              type="date"
              name="to"
              required
              defaultValue={range.key === "custom" ? range.to : undefined}
              className="h-9 rounded-lg bg-surface-3 px-3 text-foreground"
            />
          </label>
          <button className={`${buttonClass("primary", "sm")} h-9`}>Apply</button>
        </form>
      </details>
    </div>
  );
}
