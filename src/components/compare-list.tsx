import Link from "next/link";
import { Cover } from "@/components/cover";
import { Section } from "@/components/ui";
import { formatMinutes } from "@/lib/format";
import type { TopItem } from "@/lib/stats";

// Rank change of an item against the previous period's list
function change(index: number, previousIndex: number) {
  if (previousIndex === -1) return { text: "New", label: "new this period" };
  const diff = previousIndex - index;
  if (diff === 0) return { text: "=", label: "same rank" };
  return diff > 0
    ? { text: `↑${diff}`, label: `up ${diff}` }
    : { text: `↓${-diff}`, label: `down ${-diff}` };
}

export function CompareList({
  title,
  items,
  previous,
  hrefPrefix,
  rounded,
}: {
  title: string;
  items: TopItem[];
  previous: TopItem[];
  hrefPrefix: string;
  rounded?: boolean;
}) {
  const previousIds = previous.map((item) => item.id);
  return (
    <Section title={title}>
      {items.length ? (
        <ol className="-mx-2">
          {items.map((item, index) => {
            const badge = change(index, previousIds.indexOf(item.id));
            return (
              <li key={item.id}>
                <Link href={`${hrefPrefix}${item.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-surface">
                  <span className="w-6 shrink-0 text-right text-sm font-medium text-subtle tabular-nums">{index + 1}</span>
                  <Cover src={item.imageUrl} size={48} rounded={rounded} label={item.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{item.name}</p>
                    <p className="truncate text-sm text-muted">{formatMinutes(item.msPlayed)} min</p>
                  </div>
                  <span
                    aria-label={badge.label}
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium tabular-nums ${badge.text === "New" ? "bg-accent-fill/20 text-accent" : badge.text.startsWith("↑") ? "bg-surface-2 text-foreground" : "text-subtle"}`}
                  >
                    {badge.text}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="rounded-2xl bg-surface px-5 py-4 text-sm text-muted">No plays in this period yet.</p>
      )}
    </Section>
  );
}
