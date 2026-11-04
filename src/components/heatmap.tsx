"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { DayPlays } from "@/components/day-plays";

export interface HeatmapDay {
  date: string;
  label: string;
  // null for days after today
  minutes: number | null;
}

// One hue, dark (little) to bright (a lot), on the dark surface
const LEVELS = ["var(--surface-2)", "#14432a", "#1a7040", "#22a556", "#6ee7a0"];
const CELL = 12;
const GAP = 3;

// Level 1-4 by quartile of the days with any listening, so one huge day
// doesn't flatten everything else.
function levelThresholds(minutes: number[]): number[] {
  const sorted = minutes.filter((m) => m > 0).sort((a, b) => a - b);
  if (!sorted.length) return [Infinity, Infinity, Infinity];
  const at = (q: number) => sorted[Math.floor((sorted.length - 1) * q)];
  return [at(0.25), at(0.5), at(0.75)];
}

// Calendar of minutes per day: one column per week, its first day on top.
// `days` must start on the first day of a week and cover whole weeks. Days
// with plays open a window listing them. The grid is one tab stop, and the
// arrow keys move between days.
export function Heatmap({ days, monthLabels }: { days: HeatmapDay[]; monthLabels: { column: number; label: string }[] }) {
  const [active, setActive] = useState<number | null>(null);
  const [opened, setOpened] = useState<HeatmapDay | null>(null);
  // The day that takes keyboard focus; starts on today
  const [cursor, setCursor] = useState(() => days.findLastIndex((day) => day.minutes !== null));
  // On narrow screens the grid scrolls; start at the most recent weeks
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scroller.current) scroller.current.scrollLeft = scroller.current.scrollWidth;
  }, []);
  const thresholds = levelThresholds(days.map((day) => day.minutes ?? 0));
  const level = (minutes: number) =>
    minutes <= 0 ? 0 : 1 + thresholds.filter((threshold) => minutes > threshold).length;
  const weeks = Math.ceil(days.length / 7);
  const activeDay = active === null ? null : days[active];

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7 }[event.key];
    if (!step) return;
    event.preventDefault();
    const next = Number((event.target as HTMLElement).dataset.index) + step;
    if (days[next]?.minutes === null || !days[next]) return;
    setCursor(next);
    event.currentTarget.querySelector<HTMLElement>(`[data-index="${next}"]`)?.focus();
  };

  return (
    <div className="space-y-3">
      <div ref={scroller} className="overflow-x-auto pb-2">
        <div className="relative" style={{ width: weeks * (CELL + GAP) }}>
          <div className="relative mb-1 h-4 text-xs text-muted" aria-hidden>
            {monthLabels.map((month) => (
              <span key={month.column} className="absolute" style={{ left: month.column * (CELL + GAP) }}>
                {month.label}
              </span>
            ))}
          </div>
          <div
            className="grid grid-flow-col"
            style={{ gridTemplateRows: `repeat(7, ${CELL}px)`, gap: GAP }}
            onMouseLeave={() => setActive(null)}
            onKeyDown={onKeyDown}
          >
            {days.map((day, index) => {
              const style = {
                // A wave from the oldest week to this one
                animationDelay: `${Math.floor(index / 7) * 10 + (index % 7) * 15}ms`,
                width: CELL,
                height: CELL,
                background: day.minutes === null ? "transparent" : LEVELS[level(day.minutes)],
              };
              if (day.minutes === null) return <span key={day.date} style={style} />;
              const hasPlays = day.minutes > 0;
              return (
                <button
                  key={day.date}
                  type="button"
                  data-index={index}
                  tabIndex={index === cursor ? 0 : -1}
                  aria-disabled={!hasPlays}
                  aria-label={`${day.label}: ${day.minutes} minutes`}
                  className={`animate-pop rounded-[3px] transition-transform ${hasPlays ? "cursor-pointer hover:scale-125" : "cursor-default"} ${active === index ? "ring-1 ring-foreground" : ""}`}
                  style={style}
                  onClick={() => hasPlays && setOpened(day)}
                  onMouseEnter={() => setActive(index)}
                  onFocus={() => {
                    setActive(index);
                    setCursor(index);
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>
      {/* A readout instead of a floating tooltip: the grid scrolls sideways on phones */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-muted" aria-live="polite">
          {activeDay ? (
            <>
              <span className="font-semibold text-foreground tabular-nums">{activeDay.minutes ?? 0} min</span>{" "}
              on {activeDay.label}
            </>
          ) : (
            "Hover a day to see how much you listened, click it to see what you played"
          )}
        </p>
        <div className="flex items-center gap-1.5 text-xs text-muted" aria-hidden>
          Less
          {LEVELS.map((color) => (
            <span key={color} className="rounded-[3px]" style={{ width: CELL, height: CELL, background: color }} />
          ))}
          More
        </div>
      </div>
      {opened && <DayPlays key={opened.date} date={opened.date} label={opened.label} onClose={() => setOpened(null)} />}
    </div>
  );
}
