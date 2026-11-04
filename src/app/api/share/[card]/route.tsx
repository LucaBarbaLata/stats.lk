import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import type { ReactElement, ReactNode } from "react";
import { appUrl } from "@/lib/env";
import { formatMinutes, formatNumber } from "@/lib/format";
import { yearRange } from "@/lib/periods";
import { parseRange } from "@/lib/ranges";
import { getCurrentUser } from "@/lib/session";
import { getPeriodTotals, getTopArtists, getTopGenres, getTopTracks, type TopItem } from "@/lib/stats";

// Story-sized share cards (PNG). They only show what the user doesn't hide
// from others. Rendered with Satori: every element with several children
// needs display: flex, and there is no grid.

const SIZE = { width: 1080, height: 1920 };
const COLORS = { background: "#0c0c11", glow: "#0f3d22", text: "#f3f3f6", muted: "#a1a1b3", accent: "#4ade80" };

const RANGE_LABELS: Record<string, string> = {
  "4w": "Last 4 weeks",
  "6m": "Last 6 months",
  "1y": "Last year",
  all: "All time",
};

function Frame({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: "110px 90px 90px",
        backgroundColor: COLORS.background,
        backgroundImage: `linear-gradient(180deg, ${COLORS.glow} 0%, ${COLORS.background} 55%)`,
        color: COLORS.text,
      }}
    >
      <div style={{ display: "flex", fontSize: 40, color: COLORS.accent }}>stats.lk</div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: 56 }}>
        <div style={{ display: "flex", fontSize: 92, lineHeight: 1.05, letterSpacing: -2 }}>{title}</div>
        <div style={{ display: "flex", fontSize: 44, color: COLORS.muted, marginTop: 18 }}>{subtitle}</div>
      </div>
      {children}
      <div style={{ display: "flex", marginTop: "auto", fontSize: 34, color: COLORS.muted }}>
        {new URL(appUrl()).host}
      </div>
    </div>
  );
}

function Picture({ src, size, round, label }: { src: string | null; size: number; round?: boolean; label: string }) {
  const radius = round ? size / 2 : 18;
  if (!src) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: "#1e1e28",
          color: COLORS.muted,
          fontSize: size / 2.5,
        }}
      >
        {label.charAt(0).toUpperCase()}
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- Satori renders plain <img>
  return <img src={src} alt="" width={size} height={size} style={{ borderRadius: radius, objectFit: "cover" }} />;
}

function Ranking({ items, round }: { items: TopItem[]; round?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 40, marginTop: 90 }}>
      {items.map((item, index) => (
        <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 36 }}>
          <div style={{ display: "flex", width: 56, fontSize: 52, color: COLORS.muted }}>{index + 1}</div>
          <Picture src={item.imageUrl} size={180} round={round} label={item.name} />
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", fontSize: 54, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
              {item.name}
            </div>
            <div style={{ display: "flex", fontSize: 36, color: COLORS.muted, marginTop: 6 }}>
              {round ? `${formatMinutes(item.msPlayed)} minutes` : item.subtitle}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

const empty = (text: string) => (
  <div style={{ display: "flex", marginTop: 120, fontSize: 48, color: COLORS.muted }}>{text}</div>
);

export async function GET(request: NextRequest, ctx: RouteContext<"/api/share/[card]">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Not logged in", { status: 401 });
  const { card } = await ctx.params;
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const publicOnly = { publicOnly: true };
  let element: ReactElement;

  if (card === "top-artists" || card === "top-tracks") {
    const range = parseRange(params);
    const subtitle = range.key === "custom" ? range.label : RANGE_LABELS[range.key];
    const isArtists = card === "top-artists";
    const items = isArtists
      ? await getTopArtists(user.id, range, "minutes", 5, publicOnly)
      : await getTopTracks(user.id, range, "plays", 5, publicOnly);
    element = (
      <Frame title={isArtists ? "My top artists" : "My top tracks"} subtitle={subtitle}>
        {items.length ? <Ranking items={items} round={isArtists} /> : empty("No plays in this period yet.")}
      </Frame>
    );
  } else if (card === "wrapped") {
    const year = /^\d{4}$/.test(params.year ?? "") ? Number(params.year) : new Date().getFullYear();
    const range = yearRange(year);
    const [totals, artists, tracks, genres] = await Promise.all([
      getPeriodTotals(user.id, range),
      getTopArtists(user.id, range, "minutes", 1, publicOnly),
      getTopTracks(user.id, range, "plays", 5, publicOnly),
      getTopGenres(user.id, range, "minutes", 1, publicOnly),
    ]);
    const [artist] = artists;
    element = (
      <Frame title={`My ${year} Wrapped`} subtitle={`${formatNumber(totals.streams)} plays`}>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 70 }}>
          <div style={{ display: "flex", fontSize: 190, lineHeight: 1, letterSpacing: -6 }}>
            {formatMinutes(totals.msPlayed)}
          </div>
          <div style={{ display: "flex", fontSize: 46, color: COLORS.muted }}>
            minutes listened{genres[0] ? ` · mostly ${genres[0].name}` : ""}
          </div>
        </div>
        {artist && (
          <div style={{ display: "flex", alignItems: "center", gap: 40, marginTop: 80 }}>
            <Picture src={artist.imageUrl} size={260} round label={artist.name} />
            <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", fontSize: 36, color: COLORS.accent }}>Top artist</div>
              <div style={{ display: "flex", fontSize: 72, lineHeight: 1.1 }}>{artist.name}</div>
            </div>
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 80 }}>
          <div style={{ display: "flex", fontSize: 36, color: COLORS.accent }}>Top tracks</div>
          {tracks.map((track, index) => (
            <div key={track.id} style={{ display: "flex", gap: 24, fontSize: 46 }}>
              <span style={{ width: 44, color: COLORS.muted }}>{index + 1}</span>
              <span style={{ overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{track.name}</span>
            </div>
          ))}
        </div>
      </Frame>
    );
  } else {
    return new Response("Unknown card", { status: 404 });
  }

  const download = params.download === "1";
  return new ImageResponse(element, {
    ...SIZE,
    headers: {
      "Cache-Control": "private, no-store",
      ...(download && { "Content-Disposition": `attachment; filename="stats-lk-${card}.png"` }),
    },
  });
}
