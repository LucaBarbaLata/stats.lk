import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/ui";

// Tabs under a page title (Top: tracks/artists/..., Insights: compare/...)
export function SubNav({
  label,
  items,
}: {
  label: string;
  items: { href: string; label: string; active: boolean }[];
}) {
  return (
    <nav className="flex gap-6 overflow-x-auto border-b border-border [scrollbar-width:none]" aria-label={label}>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={`-mb-px border-b-2 py-3 text-[15px] whitespace-nowrap transition ${item.active ? "border-accent font-medium text-foreground" : "border-transparent text-muted hover:text-foreground"}`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

const INSIGHTS = [
  { key: "compare", label: "Compare" },
  { key: "timeline", label: "Timeline" },
  { key: "discover", label: "Discover" },
  { key: "trophies", label: "Trophies" },
] as const;

const INSIGHT_DESCRIPTIONS = {
  compare: "How this week, month or year stacks up against the one before.",
  timeline: "Your years side by side, and the artists that defined each stretch.",
  discover: "Artists you found recently, and favourites you stopped playing.",
  trophies: "Your level, the trophies you've earned and how close the next ones are.",
};

export function InsightsHeader({
  active,
  actions,
}: {
  active: (typeof INSIGHTS)[number]["key"];
  actions?: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <PageHeader title="Insights" description={INSIGHT_DESCRIPTIONS[active]} actions={actions} />
      <SubNav
        label="Insights"
        items={INSIGHTS.map((item) => ({
          href: `/insights/${item.key}`,
          label: item.label,
          active: item.key === active,
        }))}
      />
    </div>
  );
}
