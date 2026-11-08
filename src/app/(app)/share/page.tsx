import { TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Select } from "@/components/select";
import { ShareActions } from "@/components/share-actions";
import { ShareBuilderForm } from "@/components/share-builder";
import { buttonClass, PageHeader, Segmented } from "@/components/ui";
import { today } from "@/lib/dates";
import { PRESETS } from "@/lib/ranges";
import { requireUser } from "@/lib/session";
import {
  CARDS,
  isRanking,
  layoutsFor,
  MAX_STATS,
  MAX_TITLE,
  parseShareConfig,
  planStats,
  shareQuery,
  STATS,
  statLabel,
  type ShareConfig,
  type SummaryLayout,
} from "@/lib/share/options";
import { THEME_KEYS, THEMES } from "@/lib/share/themes";
import { getListeningYears } from "@/lib/stats";

export const metadata: Metadata = { title: "Share" };

const fieldClass =
  "h-11 w-full rounded-xl bg-surface px-4 text-foreground ring-1 ring-border/70 transition ring-inset placeholder:text-subtle hover:ring-border-strong focus:ring-accent/60 focus:outline-none";

function Control({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted">{label}</p>
      {children}
    </div>
  );
}

export default async function SharePage({ searchParams }: PageProps<"/share">) {
  const query = await searchParams;
  const user = await requireUser();
  const years = await getListeningYears(user.id);
  const config = parseShareConfig(query, years[0] ?? Number(today().slice(0, 4)));
  if (config.card === "wrapped" && years.length && !years.includes(config.year)) config.year = years[0];

  const imageUrl = `/api/share/${config.card}?${shareQuery(config)}`;
  // Page links keep every choice, so the custom card survives a look at the others
  const href = (changes: Partial<ShareConfig>) => {
    const next = { ...config, ...changes };
    return `/share?${new URLSearchParams({
      card: next.card,
      layout: next.layout,
      theme: next.theme,
      range: next.range,
      year: String(next.year),
      period: next.period,
      title: next.title,
      stats: next.stats.join(","),
    })}`;
  };
  const dropped = isRanking(config.card) ? [] : planStats(config.layout as SummaryLayout, config.stats).dropped;
  const full = config.stats.length >= MAX_STATS;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Share"
        description={
          <>
            A story-sized image of your stats, in the layout and colours you like. Artists and tracks you{" "}
            <Link href="/settings/privacy" className="text-accent hover:underline">
              hid from others
            </Link>{" "}
            are left out.
          </>
        }
      />

      <div className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0 space-y-6">
          <Control label="Image">
            <Segmented
              label="Image"
              items={CARDS.map((option) => ({ href: href({ card: option.key }), label: option.label, active: option.key === config.card }))}
            />
          </Control>

          <Control label="Layout">
            <Segmented
              label="Layout"
              items={layoutsFor(config.card).map((option) => ({
                href: href({ layout: option.key }),
                label: option.label,
                active: option.key === config.layout,
              }))}
            />
          </Control>

          <Control label="Theme">
            <Segmented
              label="Theme"
              items={THEME_KEYS.map((key) => ({
                href: href({ theme: key }),
                label: (
                  <span className="flex items-center gap-2">
                    <span aria-hidden className="size-3.5 rounded-full ring-1 ring-white/15" style={{ background: THEMES[key].swatch }} />
                    {THEMES[key].label}
                  </span>
                ),
                active: key === config.theme,
              }))}
            />
          </Control>

          {isRanking(config.card) && (
            <Control label="Period">
              <Segmented
                label="Period"
                items={PRESETS.map((preset) => ({ href: href({ range: preset.key }), label: preset.label, active: preset.key === config.range }))}
              />
            </Control>
          )}

          {config.card === "wrapped" && (
            <Control label="Year">
              <Segmented
                label="Year"
                items={years.map((year) => ({ href: href({ year }), label: String(year), active: year === config.year }))}
              />
            </Control>
          )}

          {config.card === "custom" && (
            <ShareBuilderForm>
              <input type="hidden" name="card" value="custom" />
              <input type="hidden" name="layout" value={config.layout} />
              <input type="hidden" name="theme" value={config.theme} />
              {/* Present even with every box unticked, so "none" isn't read as "the defaults" */}
              <input type="hidden" name="stats" value="" />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-sm text-muted">Title</span>
                  <input
                    type="text"
                    name="title"
                    defaultValue={config.title}
                    maxLength={MAX_TITLE}
                    autoComplete="off"
                    className={fieldClass}
                  />
                </label>
                <div className="space-y-2">
                  <span id="share-period" className="block text-sm text-muted">
                    Period
                  </span>
                  <Select
                    name="period"
                    labelledBy="share-period"
                    defaultValue={config.period}
                    options={[
                      ...PRESETS.map((preset) => ({ value: preset.key, label: preset.label })),
                      ...years.map((year) => ({ value: String(year), label: String(year) })),
                    ]}
                  />
                </div>
              </div>

              <fieldset className="space-y-2">
                <legend className="text-sm text-muted">
                  Stats{" "}
                  <span className="text-subtle tabular-nums">
                    · {config.stats.length} of {MAX_STATS}
                  </span>
                </legend>
                <div className="flex flex-wrap gap-2 pt-2">
                  {STATS.map((stat) => {
                    const checked = config.stats.includes(stat.key);
                    return (
                      <label
                        key={stat.key}
                        className="relative inline-flex cursor-default items-center rounded-full bg-surface px-3.5 py-1.5 text-sm text-muted ring-1 ring-border/70 transition ring-inset select-none hover:text-foreground has-checked:bg-accent-fill/15 has-checked:text-foreground has-checked:ring-accent/40 has-disabled:opacity-40 has-disabled:hover:text-muted has-focus-visible:outline-2 has-focus-visible:outline-accent"
                      >
                        <input
                          type="checkbox"
                          name="stats"
                          value={stat.key}
                          defaultChecked={checked}
                          disabled={full && !checked}
                          className="sr-only"
                        />
                        {stat.label}
                      </label>
                    );
                  })}
                </div>
                {full && <p className="text-sm text-subtle">That&apos;s the most a card holds. Untick one to pick another.</p>}
              </fieldset>

              {dropped.length > 0 && (
                <p role="status" className="flex items-start gap-2 text-sm text-amber-200">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                  <span>
                    No room for {dropped.map(statLabel).join(", ")} in this layout. Untick something
                    {config.layout === "stack" ? "." : ", or try Stack, which has the most room."}
                  </span>
                </p>
              )}

              <noscript>
                <button className={buttonClass("secondary", "sm")}>Update preview</button>
              </noscript>
            </ShareBuilderForm>
          )}

          <ShareActions url={imageUrl} filename={`stats-lk-${config.card}.png`} />
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element -- generated per request, not optimizable */}
        <img
          key={imageUrl}
          src={imageUrl}
          alt="Preview of the share image"
          width={1080}
          height={1920}
          className="w-full max-w-72 justify-self-center rounded-3xl bg-surface shadow-2xl shadow-black/50 md:sticky md:top-24 md:w-80"
        />
      </div>
    </div>
  );
}
