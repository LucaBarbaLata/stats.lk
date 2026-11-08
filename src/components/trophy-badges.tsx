"use client";

import { ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { TIER_COLORS, TrophyBadge, TrophyProgress } from "@/components/trophies";
import { formatNumber } from "@/lib/format";
import { CATEGORIES, TIER_NAMES, type TrophyResult } from "@/lib/trophies";

const tierName = (trophy: TrophyResult) => (trophy.tiers.length > 1 ? TIER_NAMES[trophy.tier - 1] : "Unlocked");

const tint = (color: string, percent: number) => `color-mix(in srgb, ${color} ${percent}%, transparent)`;

// A tier's threshold with its unit: "25 plays", "1,000 min", "60%", "1 friend"
function amount(trophy: TrophyResult, threshold: number): string {
  if (trophy.unit === "%") return `${threshold}%`;
  if (!trophy.unit) return formatNumber(threshold);
  const unit = threshold === 1 && trophy.unit.endsWith("s") ? trophy.unit.slice(0, -1) : trophy.unit;
  return `${formatNumber(threshold)} ${unit}`;
}

// Unlocked trophies as a row of coloured pills (for profiles). Each one
// opens a window with what it takes and how far along its owner is.
export function TrophyBadges({
  trophies,
  limit = 8,
  seeAllHref,
}: {
  trophies: TrophyResult[];
  limit?: number;
  // The owner's full trophy page, when the viewer is the owner
  seeAllHref?: string;
}) {
  const [open, setOpen] = useState<TrophyResult | null>(null);
  const unlocked = trophies
    .filter((trophy) => trophy.tier > 0)
    .sort((a, b) => b.tier - a.tier)
    .slice(0, limit);
  if (!unlocked.length) return <p className="text-sm text-subtle">No trophies yet.</p>;

  return (
    <>
      <ul className="flex flex-wrap gap-2">
        {unlocked.map((trophy) => {
          const color = TIER_COLORS[trophy.tier - 1];
          return (
            <li key={trophy.key}>
              <button
                type="button"
                aria-haspopup="dialog"
                aria-label={`${trophy.name}, ${tierName(trophy).toLowerCase()}`}
                onClick={() => setOpen(trophy)}
                className="flex items-center gap-2 rounded-full bg-(--pill) py-1 pr-3 pl-1 text-sm transition hover:bg-(--pill-hover) active:scale-[0.98]"
                style={{ ["--pill" as string]: tint(color, 14), ["--pill-hover" as string]: tint(color, 26) }}
              >
                <TrophyBadge icon={trophy.icon} tier={trophy.tier} size={28} />
                {trophy.name}
              </button>
            </li>
          );
        })}
      </ul>
      {open && <TrophyDialog key={open.key} trophy={open} seeAllHref={seeAllHref} onClose={() => setOpen(null)} />}
    </>
  );
}

// Same window as the day's plays on Activity: a native <dialog> that traps
// focus and closes on Escape or a click on the backdrop
function TrophyDialog({
  trophy,
  seeAllHref,
  onClose,
}: {
  trophy: TrophyResult;
  seeAllHref?: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
  }, []);

  const close = () => dialog.current?.close();
  const category = CATEGORIES.find((entry) => entry.key === trophy.category)?.label;

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialog.current) close();
      }}
      className="m-auto w-[min(24rem,calc(100vw-2rem))] animate-page overflow-hidden rounded-3xl border border-border bg-surface text-foreground shadow-2xl shadow-black/50 backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      <div className="relative flex flex-col items-center gap-4 px-6 pt-8 pb-6 text-center">
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute top-4 right-4 flex size-9 items-center justify-center rounded-full bg-surface-2 text-muted transition hover:bg-surface-3 hover:text-foreground"
        >
          <X className="size-4" />
        </button>
        <TrophyBadge icon={trophy.icon} tier={trophy.tier} size={96} className="animate-pop" />
        <div className="space-y-1">
          <h2 id={titleId} className="text-xl font-semibold tracking-tight">
            {trophy.name}
          </h2>
          <p className="text-sm text-muted">
            {tierName(trophy)}
            {category && ` · ${category}`}
          </p>
        </div>
      </div>

      <div className="space-y-5 border-t border-border/70 px-6 py-5">
        <TrophyProgress trophy={trophy} />
        {trophy.tiers.length > 1 && (
          <ol className="grid grid-cols-3 gap-2">
            {trophy.tiers.map((threshold, index) => {
              const reached = index < trophy.tier;
              const color = TIER_COLORS[index];
              return (
                <li
                  key={threshold}
                  className="space-y-0.5 rounded-2xl px-3 py-2.5"
                  style={{ background: reached ? tint(color, 14) : "var(--surface-2)" }}
                >
                  <p className="flex items-center gap-1.5 text-xs font-medium" style={{ color: reached ? color : "var(--subtle)" }}>
                    <span aria-hidden className="size-1.5 rounded-full" style={{ background: reached ? color : "var(--surface-3)" }} />
                    {TIER_NAMES[index]}
                    <span className="sr-only">{reached ? ", reached" : ", not reached yet"}</span>
                  </p>
                  <p className={`text-sm tabular-nums ${reached ? "text-foreground" : "text-muted"}`}>{amount(trophy, threshold)}</p>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {seeAllHref && (
        <div className="border-t border-border/70 p-2">
          <Link
            href={seeAllHref}
            className="group flex items-center justify-center gap-0.5 rounded-full py-2 text-sm text-muted transition hover:bg-surface-2 hover:text-foreground"
          >
            See all trophies
            <ChevronRight className="size-4 transition group-hover:translate-x-0.5" />
          </Link>
        </div>
      )}
    </dialog>
  );
}
