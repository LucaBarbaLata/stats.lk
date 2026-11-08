import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { appUrl } from "@/lib/env";
import { yearRange } from "@/lib/periods";
import { parseRange } from "@/lib/ranges";
import { getCurrentUser } from "@/lib/session";
import { parseDesign, renderShareCard, SHARE_SIZE, type ShareCard } from "@/lib/share-cards";
import { getPeriodTotals, getTopArtists, getTopGenres, getTopTracks } from "@/lib/stats";

// Share images (PNG) in the chosen design, drawn in src/lib/share-cards.tsx.
// They only show what the user doesn't hide from others.

const RANGE_LABELS: Record<string, string> = {
  "4w": "Last 4 weeks",
  "6m": "Last 6 months",
  "1y": "Last year",
  all: "All time",
};

export async function GET(request: NextRequest, ctx: RouteContext<"/api/share/[card]">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Not logged in", { status: 401 });
  const { card: kind } = await ctx.params;
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const publicOnly = { publicOnly: true };
  let card: ShareCard;

  if (kind === "top-artists" || kind === "top-tracks") {
    const range = parseRange(params);
    const items =
      kind === "top-artists"
        ? await getTopArtists(user.id, range, "minutes", 5, publicOnly)
        : await getTopTracks(user.id, range, "plays", 5, publicOnly);
    card = { kind, subtitle: range.key === "custom" ? range.label : RANGE_LABELS[range.key], items };
  } else if (kind === "wrapped") {
    const year = /^\d{4}$/.test(params.year ?? "") ? Number(params.year) : new Date().getFullYear();
    const range = yearRange(year);
    const [totals, artists, tracks, genres] = await Promise.all([
      getPeriodTotals(user.id, range),
      getTopArtists(user.id, range, "minutes", 1, publicOnly),
      getTopTracks(user.id, range, "plays", 5, publicOnly),
      getTopGenres(user.id, range, "minutes", 1, publicOnly),
    ]);
    card = {
      kind,
      year,
      streams: totals.streams,
      msPlayed: totals.msPlayed,
      genre: genres[0]?.name ?? null,
      artist: artists[0] ?? null,
      tracks,
    };
  } else {
    return new Response("Unknown card", { status: 404 });
  }

  const element = renderShareCard(card, parseDesign(params.design), new URL(appUrl()).host);
  const download = params.download === "1";
  return new ImageResponse(element, {
    ...SHARE_SIZE,
    headers: {
      "Cache-Control": "private, no-store",
      ...(download && { "Content-Disposition": `attachment; filename="stats-lk-${kind}.png"` }),
    },
  });
}
