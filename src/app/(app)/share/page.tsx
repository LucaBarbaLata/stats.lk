import type { Metadata } from "next";
import Link from "next/link";
import { ShareActions } from "@/components/share-actions";
import { PageHeader, Segmented } from "@/components/ui";
import { today } from "@/lib/dates";
import { PRESETS } from "@/lib/ranges";
import { requireUser } from "@/lib/session";
import { getListeningYears } from "@/lib/stats";

const CARDS = [
  { key: "top-artists", label: "Top artists" },
  { key: "top-tracks", label: "Top tracks" },
  { key: "wrapped", label: "Wrapped" },
] as const;

export const metadata: Metadata = { title: "Share" };

export default async function SharePage({ searchParams }: PageProps<"/share">) {
  const query = await searchParams;
  const user = await requireUser();
  const card = CARDS.find((c) => c.key === query.card)?.key ?? "top-artists";
  const range = PRESETS.find((p) => p.key === query.range)?.key ?? "4w";
  const years = await getListeningYears(user.id);
  const year = years.find((y) => String(y) === query.year) ?? years[0] ?? Number(today().slice(0, 4));

  const imageUrl = card === "wrapped" ? `/api/share/wrapped?year=${year}` : `/api/share/${card}?range=${range}`;
  const href = (params: Record<string, string>) =>
    `/share?${new URLSearchParams({ card, range, year: String(year), ...params })}`;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Share"
        description={
          <>
            A story-sized image of your stats. Artists and tracks you{" "}
            <Link href="/settings" className="text-accent hover:underline">
              hid from others
            </Link>{" "}
            are left out.
          </>
        }
      />

      <div className="grid grid-cols-1 gap-8 md:grid-cols-[1fr_auto]">
        <div className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm text-muted">Image</p>
            <Segmented
              label="Image"
              items={CARDS.map((option) => ({ href: href({ card: option.key }), label: option.label, active: option.key === card }))}
            />
          </div>
          <div className="space-y-2">
            <p className="text-sm text-muted">{card === "wrapped" ? "Year" : "Period"}</p>
            <Segmented
              label={card === "wrapped" ? "Year" : "Period"}
              items={
                card === "wrapped"
                  ? years.map((option) => ({ href: href({ year: String(option) }), label: String(option), active: option === year }))
                  : PRESETS.map((preset) => ({ href: href({ range: preset.key }), label: preset.label, active: preset.key === range }))
              }
            />
          </div>
          <ShareActions url={imageUrl} filename={`stats-lk-${card}.png`} />
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element -- generated per request, not optimizable */}
        <img
          key={imageUrl}
          src={imageUrl}
          alt="Preview of the share image"
          width={1080}
          height={1920}
          className="w-full max-w-72 justify-self-center rounded-3xl bg-surface shadow-2xl shadow-black/50 md:w-80"
        />
      </div>
    </div>
  );
}
