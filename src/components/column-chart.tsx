"use client";

import { useState, type ReactNode } from "react";
import type { ChartPoint } from "@/lib/series";

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const full = new Intl.NumberFormat("en-US");

// Rounds the axis maximum up to 1, 2 or 5 times a power of ten
function niceMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 5, 10].find((n) => n * magnitude >= value)!;
  return step * magnitude;
}

const AXIS_WIDTH = "2.5rem";
const PLOT_LEFT = `calc(${AXIS_WIDTH} + 0.5rem)`;
// Horizontal centre of column `index` of `count`, as a CSS length
const columnCenter = (index: number, count: number) =>
  `calc(${PLOT_LEFT} + (100% - ${PLOT_LEFT}) * ${(index + 0.5) / count})`;

export interface LegendItem {
  label: string;
  color: string;
}

// Column chart of minutes listened, with a hover/focus tooltip per column,
// the peak labelled on the chart, an optional colour per column (with a
// legend), and a table view of the same numbers.
export function ColumnChart({
  title,
  summary,
  data,
  colors,
  legend,
  labelEvery = 1,
  height = 200,
}: {
  title: string;
  // One sentence about the chart, shown under the title
  summary?: ReactNode;
  data: ChartPoint[];
  // A colour per column; defaults to the accent
  colors?: string[];
  legend?: LegendItem[];
  // Show every n-th x label so they don't collide
  labelEvery?: number;
  height?: number;
}) {
  const [active, setActive] = useState<number | null>(null);
  const top = Math.max(0, ...data.map((point) => point.minutes));
  const max = niceMax(top);
  const ticks = [0, max / 2, max];
  const peak = top > 0 ? data.findIndex((point) => point.minutes === top) : -1;
  const activePoint = active === null ? null : data[active];
  const colorAt = (index: number) => colors?.[index] ?? "var(--accent)";

  return (
    <figure className="space-y-3">
      <figcaption className="space-y-1 pb-2">
        <span className="block font-medium">{title}</span>
        {summary && <span className="block text-sm text-muted">{summary}</span>}
      </figcaption>

      <div className="relative" style={{ height }}>
        {ticks.map((tick) => (
          <div
            key={tick}
            className="absolute inset-x-0 flex items-center gap-2"
            style={{ bottom: `${(tick / max) * 100}%`, transform: "translateY(50%)" }}
          >
            <span className="shrink-0 text-right text-xs text-subtle tabular-nums" style={{ width: AXIS_WIDTH }}>
              {compact.format(tick)}
            </span>
            <span className="h-px flex-1 bg-border/70" />
          </div>
        ))}

        <div
          className="absolute inset-y-0 right-0 flex items-end gap-[3px]"
          style={{ left: PLOT_LEFT }}
          onMouseLeave={() => setActive(null)}
        >
          {data.map((point, index) => (
            <button
              key={point.fullLabel}
              type="button"
              aria-label={`${point.fullLabel}: ${full.format(point.minutes)} minutes, ${full.format(point.plays)} plays`}
              className="flex h-full min-w-0 flex-1 cursor-default items-end justify-center rounded-sm outline-none focus-visible:ring-1 focus-visible:ring-accent"
              onMouseEnter={() => setActive(index)}
              onFocus={() => setActive(index)}
              onBlur={() => setActive(null)}
            >
              <span
                className="w-full max-w-7 origin-bottom animate-grow-y rounded-t-[4px] transition-opacity"
                style={{
                  animationDelay: `${Math.min(index, 40) * 18}ms`,
                  height: `${(point.minutes / max) * 100}%`,
                  minHeight: point.minutes > 0 ? 3 : 0,
                  background: colorAt(index),
                  opacity: active === null || active === index ? 1 : 0.45,
                }}
              />
            </button>
          ))}
        </div>

        {/* The peak gets its value written above it; the tooltip replaces it on hover */}
        {peak >= 0 && active === null && (
          <span
            aria-hidden
            className="pointer-events-none absolute -translate-x-1/2 text-xs font-medium whitespace-nowrap text-foreground tabular-nums"
            style={{ left: columnCenter(peak, data.length), bottom: `calc(${(top / max) * 100}% + 6px)` }}
          >
            {full.format(top)} min
          </span>
        )}

        {activePoint && active !== null && (
          <div
            role="status"
            className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-xl border border-border bg-surface-3 px-3 py-2 text-sm whitespace-nowrap shadow-xl shadow-black/40"
            style={{
              left: columnCenter(active, data.length),
              bottom: `calc(${Math.min(100, (activePoint.minutes / max) * 100)}% + 8px)`,
            }}
          >
            <p className="font-semibold tabular-nums">{full.format(activePoint.minutes)} min</p>
            <p className="text-muted">
              {activePoint.fullLabel} · {full.format(activePoint.plays)} plays
            </p>
          </div>
        )}
      </div>

      <div className="flex gap-[3px]" style={{ marginLeft: PLOT_LEFT }} aria-hidden>
        {data.map((point, index) => (
          <span
            key={point.fullLabel}
            className={`min-w-0 flex-1 text-center text-xs whitespace-nowrap ${index === peak ? "font-medium text-foreground" : "text-subtle"}`}
          >
            {index % labelEvery === 0 || index === peak ? point.label : ""}
          </span>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        {legend ? (
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            {legend.map((item) => (
              <li key={item.label} className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-[3px]" style={{ background: item.color }} />
                {item.label}
              </li>
            ))}
          </ul>
        ) : (
          <span />
        )}
        <details className="text-sm">
          <summary className="cursor-pointer text-subtle transition hover:text-foreground">Show as table</summary>
          <div className="mt-2 max-h-64 overflow-auto rounded-xl bg-surface-2">
            <table className="w-full text-left tabular-nums">
              <thead className="sticky top-0 bg-surface-3 text-muted">
                <tr>
                  <th className="px-3 py-1.5 font-medium">Period</th>
                  <th className="px-3 py-1.5 text-right font-medium">Minutes</th>
                  <th className="px-3 py-1.5 text-right font-medium">Plays</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.map((point) => (
                  <tr key={point.fullLabel}>
                    <td className="px-3 py-1.5">{point.fullLabel}</td>
                    <td className="px-3 py-1.5 text-right">{full.format(point.minutes)}</td>
                    <td className="px-3 py-1.5 text-right">{full.format(point.plays)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>
    </figure>
  );
}
