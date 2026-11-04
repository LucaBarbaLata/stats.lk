import Link from "next/link";
import { Cover } from "@/components/cover";
import { formatMinutes, formatNumber } from "@/lib/format";

export interface TopListItem {
  id: string;
  name: string;
  imageUrl: string | null;
  subtitle: string;
  href?: string;
  // Undefined: no numbers at all. Null: nothing saved for this item yet
  // (Spotify's own ranking can list things we have no plays for).
  streams?: number | null;
  msPlayed?: number | null;
}

// A ranked list, like a tracklist: rank, cover, name, and plays/minutes on
// the right. With `bars`, each row gets a bar behind it, as long as its share
// of the first row's plays (or minutes), so differences show at a glance.
export function TopList({
  items,
  rounded,
  covers = true,
  capitalize,
  ranked = true,
  bars,
}: {
  items: TopListItem[];
  rounded?: boolean;
  covers?: boolean;
  // For lowercase names like genres
  capitalize?: boolean;
  ranked?: boolean;
  bars?: "plays" | "minutes";
}) {
  const value = (item: TopListItem) => (bars === "minutes" ? item.msPlayed : item.streams) ?? 0;
  const max = bars ? Math.max(1, ...items.map(value)) : 1;

  return (
    <ol className="-mx-2 space-y-0.5">
      {items.map((item, index) => {
        const content = (
          <>
            {bars && (
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 origin-left animate-grow-x rounded-xl bg-accent-fill/[0.07] transition-[width] duration-500"
                style={{ width: `${(value(item) / max) * 100}%`, animationDelay: `${150 + Math.min(index, 15) * 30}ms` }}
              />
            )}
            {ranked && (
              <span className="relative w-6 shrink-0 text-right text-sm font-medium text-subtle tabular-nums">{index + 1}</span>
            )}
            {covers && (
              <span className="relative">
                <Cover src={item.imageUrl} size={52} rounded={rounded} label={item.name} />
              </span>
            )}
            <div className="relative min-w-0 flex-1">
              <p className={`truncate font-medium ${capitalize ? "first-letter:uppercase" : ""}`}>{item.name}</p>
              {item.subtitle && <p className="truncate text-sm text-muted">{item.subtitle}</p>}
            </div>
            {item.streams !== undefined && (
              <div className="relative shrink-0 text-right text-sm tabular-nums">
                {item.streams === null ? (
                  <p className="text-subtle">No plays saved</p>
                ) : (
                  <>
                    <p className="font-medium">{formatNumber(item.streams)} plays</p>
                    <p className="text-subtle">{formatMinutes(item.msPlayed ?? 0)} min</p>
                  </>
                )}
              </div>
            )}
          </>
        );
        const rowClass = "relative flex items-center gap-3 overflow-hidden rounded-xl px-2 py-2";
        return (
          <li key={item.id} className="animate-rise" style={{ animationDelay: `${Math.min(index, 15) * 30}ms` }}>
            {item.href ? (
              <Link href={item.href} className={`${rowClass} transition hover:bg-surface`}>
                {content}
              </Link>
            ) : (
              <div className={rowClass}>{content}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
