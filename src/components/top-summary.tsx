import { Share2 } from "lucide-react";
import Link from "next/link";
import { Cover } from "@/components/cover";
import { buttonClass } from "@/components/ui";
import { formatMinutes, formatNumber } from "@/lib/format";

// Side column of a Top page: totals for the period and the number one,
// big. Sticks while the list scrolls.
export function TopSummary({
  periodLabel,
  totals,
  distinct,
  first,
  firstRounded,
  shareHref,
}: {
  periodLabel: string;
  totals: { streams: number; msPlayed: number };
  distinct: { label: string; value: number };
  first?: { name: string; imageUrl: string | null; href?: string; caption: string };
  firstRounded?: boolean;
  shareHref?: string;
}) {
  return (
    <aside className="space-y-3 lg:sticky lg:top-24">
      {first && (
        <Link
          href={first.href ?? "#"}
          className="relative isolate block overflow-hidden rounded-3xl bg-surface p-5 transition hover:bg-surface-2"
        >
          <p className="text-sm text-muted">Number one</p>
          <div className="mt-4 w-full max-w-[200px]">
            <Cover src={first.imageUrl} size={200} rounded={firstRounded} label={first.name} />
          </div>
          <p className="mt-4 text-xl leading-tight font-semibold tracking-tight">{first.name}</p>
          <p className="text-sm text-muted">{first.caption}</p>
        </Link>
      )}
      <div className="rounded-3xl bg-surface p-5">
        <p className="text-sm text-muted">{periodLabel}</p>
        <dl className="mt-4 grid grid-cols-3 gap-3">
          <div>
            <dt className="text-xs text-subtle">Plays</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums">{formatNumber(totals.streams)}</dd>
          </div>
          <div>
            <dt className="text-xs text-subtle">Minutes</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums">{formatMinutes(totals.msPlayed)}</dd>
          </div>
          <div>
            <dt className="text-xs text-subtle">{distinct.label}</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums">{formatNumber(distinct.value)}</dd>
          </div>
        </dl>
        {shareHref && (
          <Link href={shareHref} className={`${buttonClass("secondary", "sm")} mt-5 w-full`}>
            <Share2 className="size-4" /> Share this list
          </Link>
        )}
      </div>
    </aside>
  );
}
