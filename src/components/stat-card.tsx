import type { ComponentType } from "react";

export function StatCard({
  label,
  value,
  detail,
  compact,
  icon: Icon,
  index = 0,
}: {
  label: string;
  value: string;
  detail?: string;
  // Smaller value text, for dates and other longer values
  compact?: boolean;
  icon?: ComponentType<{ className?: string }>;
  // Position in a row of cards, to stagger their entrance
  index?: number;
}) {
  return (
    <div
      className="flex min-w-0 animate-rise flex-col rounded-2xl bg-surface px-4 py-4 sm:px-5"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] leading-snug text-muted sm:text-sm">{label}</p>
        {Icon && (
          <span aria-hidden className="hidden size-8 shrink-0 items-center justify-center rounded-full bg-accent-fill/15 text-accent sm:flex">
            <Icon className="size-4" />
          </span>
        )}
      </div>
      <p className={`mt-1.5 font-semibold tracking-tight ${compact ? "text-xl" : "text-2xl leading-none sm:text-[32px]"}`}>{value}</p>
      {detail && <p className="mt-2 text-sm text-subtle">{detail}</p>}
    </div>
  );
}
