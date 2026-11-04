import {
  CalendarDays,
  Compass,
  Crown,
  Disc3,
  Flame,
  Handshake,
  Headphones,
  Heart,
  History,
  Hourglass,
  Layers,
  Library,
  Moon,
  Repeat,
  Shapes,
  Sparkles,
  Star,
  Sunrise,
  Timer,
  Users,
  type LucideIcon,
} from "lucide-react";
import { formatNumber } from "@/lib/format";
import type { Level } from "@/lib/levels";
import { TIER_NAMES, type TrophyIcon, type TrophyResult } from "@/lib/trophies";

const ICONS: Record<TrophyIcon, LucideIcon> = {
  moon: Moon,
  sunrise: Sunrise,
  calendar: CalendarDays,
  timer: Timer,
  headphones: Headphones,
  flame: Flame,
  compass: Compass,
  shapes: Shapes,
  hourglass: Hourglass,
  sparkles: Sparkles,
  library: Library,
  heart: Heart,
  repeat: Repeat,
  star: Star,
  disc: Disc3,
  layers: Layers,
  users: Users,
  handshake: Handshake,
  crown: Crown,
  history: History,
};

// Bronze, silver, gold
const TIER_COLORS = ["#cd8a4b", "#c3cad6", "#f2c94c"];

// A pointy-top hexagon with rounded corners, centred in a 48x48 box
function hexagonPath(radius: number, corner: number): string {
  const points = Array.from({ length: 6 }, (_, index) => {
    const angle = (Math.PI / 3) * index - Math.PI / 2;
    return [24 + radius * Math.cos(angle), 24 + radius * Math.sin(angle)];
  });
  const toward = (from: number[], to: number[]) => {
    const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
    return [from[0] + ((to[0] - from[0]) / length) * corner, from[1] + ((to[1] - from[1]) / length) * corner];
  };
  const n = (value: number) => value.toFixed(2);
  const path = points.map((point, index) => {
    const a = toward(point, points[(index + 5) % 6]);
    const b = toward(point, points[(index + 1) % 6]);
    return `${index ? "L" : "M"}${n(a[0])} ${n(a[1])}Q${n(point[0])} ${n(point[1])} ${n(b[0])} ${n(b[1])}`;
  });
  return `${path.join("")}Z`;
}

const BADGE_OUTER = hexagonPath(23, 5);
const BADGE_INNER = hexagonPath(17, 4);

// Locked, then bronze, silver, gold: the rim, the raised plate, the inner
// face and the icon
const BADGE_COLORS = [
  { rim: "var(--surface-2)", plate: "var(--surface-3)", face: "var(--surface-2)", icon: "var(--subtle)" },
  { rim: "#6e3c19", plate: "#d38d55", face: "#9a5a2c", icon: "#ffe3c6" },
  { rim: "#5f6878", plate: "#dde3eb", face: "#8a94a5", icon: "#ffffff" },
  { rim: "#8a5f05", plate: "#f5cd4d", face: "#b5820f", icon: "#fff4c4" },
];

// A trophy as a medal: a hexagon in the tier's metal with the icon in the
// middle. Tier 0 is locked and stays grey.
export function TrophyBadge({
  icon,
  tier,
  size = 48,
  className = "",
}: {
  icon: TrophyIcon;
  tier: number;
  size?: number;
  className?: string;
}) {
  const Icon = ICONS[icon];
  const colors = BADGE_COLORS[tier];
  return (
    <span
      aria-hidden
      className={`relative inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 48 48" className="absolute inset-0 size-full drop-shadow-[0_4px_10px_rgb(0_0_0/0.35)]">
        <path d={BADGE_OUTER} style={{ fill: colors.rim }} />
        <path d={BADGE_OUTER} transform="translate(24 23) scale(0.94) translate(-24 -24)" style={{ fill: colors.plate }} />
        <path d={BADGE_INNER} style={{ fill: colors.face }} />
        {tier > 0 && <path d={BADGE_INNER} fill="none" stroke="rgb(255 255 255 / 0.3)" strokeWidth="0.8" />}
      </svg>
      <Icon className="relative" style={{ width: size * 0.38, height: size * 0.38, color: colors.icon }} strokeWidth={2.2} />
    </span>
  );
}

export function LevelCard({ level, compact }: { level: Level; compact?: boolean }) {
  const toGo = level.nextLevelAt === null ? 0 : Math.ceil(level.nextLevelAt - level.minutes);
  return (
    <div className={`flex items-center gap-5 rounded-3xl bg-surface ${compact ? "p-4" : "p-6"}`}>
      <div
        className={`relative flex shrink-0 animate-ring items-center justify-center rounded-full ${compact ? "size-16" : "size-24"}`}
        style={{
          ["--ring" as string]: `${level.progress * 360}deg`,
          background: "conic-gradient(var(--accent) var(--ring), var(--surface-3) 0deg)",
        }}
      >
        <div className={`flex flex-col items-center justify-center rounded-full bg-surface ${compact ? "size-[52px]" : "size-20"}`}>
          <span className={`leading-none font-semibold tabular-nums ${compact ? "text-xl" : "text-[32px]"}`}>{level.level}</span>
          {!compact && <span className="mt-0.5 text-[11px] text-subtle">level</span>}
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm text-muted">{compact ? `Level ${level.level}` : "Your level"}</p>
        <p className={`leading-tight font-semibold tracking-tight ${compact ? "text-lg" : "text-2xl"}`}>{level.title}</p>
        <p className="text-sm text-subtle">
          {level.nextLevelAt === null
            ? "The top level. Nothing left to prove."
            : `${formatNumber(toGo)} minutes to level ${level.level + 1}`}
        </p>
      </div>
    </div>
  );
}

export function TrophyCard({ trophy, index = 0 }: { trophy: TrophyResult; index?: number }) {
  const unlocked = trophy.tier > 0;
  const multiTier = trophy.tiers.length > 1;
  const goal = trophy.goal.replace("{n}", formatNumber(trophy.nextThreshold ?? trophy.tiers.at(-1)!));

  return (
    <li
      className="flex animate-rise flex-col gap-4 rounded-2xl bg-surface p-4 transition hover:bg-surface-2"
      style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
    >
      <div className="flex items-center gap-3">
        <TrophyBadge
          icon={trophy.icon}
          tier={trophy.tier}
          size={56}
          className="animate-pop"
        />
        <div className="min-w-0 flex-1">
          <p className={`font-medium ${unlocked ? "" : "text-muted"}`}>{trophy.name}</p>
          <p className="text-sm text-subtle">
            {unlocked ? (multiTier ? TIER_NAMES[trophy.tier - 1] : "Unlocked") : "Locked"}
          </p>
        </div>
        {multiTier && (
          <span className="flex gap-1 self-start pt-1" aria-label={`${trophy.tier} of 3 tiers`}>
            {TIER_COLORS.map((tierColor, index) => (
              <span
                key={tierColor}
                className="size-2 rounded-full"
                style={{ background: index < trophy.tier ? tierColor : "var(--surface-3)" }}
              />
            ))}
          </span>
        )}
      </div>
      {trophy.nextThreshold === null ? (
        <p className="text-sm text-muted">{trophy.goal.replace("{n}", formatNumber(trophy.tiers.at(-1)!))}. Done.</p>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-muted">{goal}</p>
          <div className="flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
              <div
                className="h-full origin-left animate-grow-x rounded-full bg-accent"
                style={{ width: `${trophy.progress * 100}%`, animationDelay: `${200 + Math.min(index, 12) * 40}ms` }}
              />
            </div>
            {trophy.unit && (
              <span className="shrink-0 text-xs text-subtle tabular-nums">
                {formatNumber(Math.floor(trophy.value))} / {formatNumber(trophy.nextThreshold)}
              </span>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

// Unlocked trophies as a row of coloured icons (for profiles)
export function TrophyBadges({ trophies, limit = 8 }: { trophies: TrophyResult[]; limit?: number }) {
  const unlocked = trophies
    .filter((trophy) => trophy.tier > 0)
    .sort((a, b) => b.tier - a.tier)
    .slice(0, limit);
  if (!unlocked.length) return <p className="text-sm text-subtle">No trophies yet.</p>;
  return (
    <ul className="flex flex-wrap gap-2">
      {unlocked.map((trophy) => {
        const color = TIER_COLORS[trophy.tier - 1];
        const tierName = trophy.tiers.length > 1 ? TIER_NAMES[trophy.tier - 1] : "Unlocked";
        return (
          <li
            key={trophy.key}
            title={`${trophy.name}, ${tierName.toLowerCase()}`}
            className="flex items-center gap-2 rounded-full py-1 pr-3 pl-1 text-sm"
            style={{ background: `color-mix(in srgb, ${color} 14%, transparent)` }}
          >
            <TrophyBadge icon={trophy.icon} tier={trophy.tier} size={28} />
            {trophy.name}
          </li>
        );
      })}
    </ul>
  );
}
