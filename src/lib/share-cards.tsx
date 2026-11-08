import type { ReactElement, ReactNode } from "react";
import { formatMinutes, formatNumber } from "./format";
import type { TopItem } from "./stats";

// The story-sized share images (1080x1920), drawn for Satori by
// /api/share/[card]. Every element with several children needs
// display: flex, and there is no grid.

export const SHARE_SIZE = { width: 1080, height: 1920 };

export const SHARE_DESIGNS = [
  { key: "classic", label: "Classic" },
  { key: "cover", label: "Cover" },
  { key: "light", label: "Light" },
  { key: "vivid", label: "Vivid" },
] as const;

export type ShareDesign = (typeof SHARE_DESIGNS)[number]["key"];

export const parseDesign = (value: unknown): ShareDesign =>
  SHARE_DESIGNS.find((design) => design.key === value)?.key ?? "classic";

type Item = Pick<TopItem, "id" | "name" | "imageUrl" | "subtitle" | "msPlayed">;

export type ShareCard =
  | { kind: "top-artists" | "top-tracks"; subtitle: string; items: Item[] }
  | {
      kind: "wrapped";
      year: number;
      streams: number;
      msPlayed: number;
      genre: string | null;
      artist: Item | null;
      tracks: Item[];
    };

interface Theme {
  background: string;
  gradient?: string;
  text: string;
  muted: string;
  accent: string;
  // Behind a missing picture
  tile: string;
  // The logo's square and its bars
  mark: [string, string];
  // The top item's picture fills the top of the card
  photo?: boolean;
}

const THEMES: Record<ShareDesign, Theme> = {
  classic: {
    background: "#0c0c11",
    gradient: "linear-gradient(180deg, #0f3d22 0%, #0c0c11 55%)",
    text: "#f3f3f6",
    muted: "#a1a1b3",
    accent: "#4ade80",
    tile: "#1e1e28",
    mark: ["#22c55e", "#04210f"],
  },
  // Classic's glow only shows when the top item has no picture
  cover: {
    background: "#0c0c11",
    gradient: "linear-gradient(180deg, #0f3d22 0%, #0c0c11 55%)",
    text: "#ffffff",
    muted: "#b4b4c2",
    accent: "#4ade80",
    tile: "#1e1e28",
    mark: ["#22c55e", "#04210f"],
    photo: true,
  },
  light: {
    background: "#f5f2ea",
    gradient: "linear-gradient(180deg, #d5ecd9 0%, #f5f2ea 50%)",
    text: "#111116",
    muted: "#666672",
    accent: "#15803d",
    tile: "#e5e0d4",
    mark: ["#15803d", "#f5f2ea"],
  },
  vivid: {
    background: "#22c55e",
    gradient: "linear-gradient(165deg, #a7f3c4 0%, #4ade80 40%, #22c55e 100%)",
    text: "#04210f",
    muted: "#0f4d29",
    accent: "#04210f",
    tile: "#16a34a",
    mark: ["#04210f", "#4ade80"],
  },
};

function Wordmark({ theme }: { theme: Theme }) {
  const [fill, bars] = theme.mark;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 42, color: theme.text }}>
      <svg width="56" height="56" viewBox="0 0 32 32">
        <rect width="32" height="32" rx="9" fill={fill} />
        <rect x="8" y="15" width="4" height="9" rx="2" fill={bars} opacity="0.7" />
        <rect x="14" y="8" width="4" height="16" rx="2" fill={bars} />
        <rect x="20" y="12" width="4" height="12" rx="2" fill={bars} opacity="0.85" />
      </svg>
      <div style={{ display: "flex" }}>
        stats<span style={{ color: theme.accent }}>.lk</span>
      </div>
    </div>
  );
}

function Frame({
  theme,
  photo,
  host,
  title,
  subtitle,
  children,
}: {
  theme: Theme;
  // The picture behind the top of the card (Cover design)
  photo: string | null;
  host: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        padding: "110px 90px 90px",
        backgroundColor: theme.background,
        // Satori fails on an undefined backgroundImage
        ...(theme.gradient && { backgroundImage: theme.gradient }),
        color: theme.text,
      }}
    >
      {photo && (
        <div style={{ position: "absolute", top: 0, left: 0, width: 1080, height: 1080, display: "flex" }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- Satori renders plain <img> */}
          <img src={photo} alt="" width={1080} height={1080} style={{ objectFit: "cover" }} />
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: 1080,
              height: 1080,
              // Darker behind the logo and the title, so they stay readable on
              // bright pictures
              backgroundImage: `linear-gradient(180deg, rgba(12,12,17,0.75) 0%, rgba(12,12,17,0.2) 28%, rgba(12,12,17,0.55) 56%, ${theme.background} 100%)`,
            }}
          />
        </div>
      )}
      <Wordmark theme={theme} />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          marginTop: photo ? 420 : 56,
          ...(photo && { textShadow: "0 2px 24px rgba(0,0,0,0.45)" }),
        }}
      >
        <div style={{ display: "flex", fontSize: 92, lineHeight: 1.05, letterSpacing: -2 }}>{title}</div>
        <div style={{ display: "flex", fontSize: 44, color: theme.muted, marginTop: 18 }}>{subtitle}</div>
      </div>
      {children}
      <div style={{ display: "flex", marginTop: "auto", fontSize: 34, color: theme.muted }}>{host}</div>
    </div>
  );
}

function Picture({ theme, src, size, round, label }: { theme: Theme; src: string | null; size: number; round?: boolean; label: string }) {
  const radius = round ? size / 2 : Math.round(size / 10);
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
          backgroundColor: theme.tile,
          color: theme.muted,
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

// Numbered rows with pictures. Under a photo the rows are smaller, to fit.
function Ranking({ theme, items, round, compact }: { theme: Theme; items: Item[]; round?: boolean; compact?: boolean }) {
  const picture = compact ? 128 : 180;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: compact ? 28 : 40, marginTop: compact ? 70 : 90 }}>
      {items.map((item, index) => (
        <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 36 }}>
          <div style={{ display: "flex", width: 56, fontSize: compact ? 46 : 52, color: theme.muted }}>
            {index + 1}
          </div>
          <Picture theme={theme} src={item.imageUrl} size={picture} round={round} label={item.name} />
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                fontSize: compact ? 48 : 54,
                overflow: "hidden",
                whiteSpace: "nowrap",
                textOverflow: "ellipsis",
              }}
            >
              {item.name}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: compact ? 32 : 36,
                color: theme.muted,
                marginTop: 6,
                overflow: "hidden",
                whiteSpace: "nowrap",
                textOverflow: "ellipsis",
              }}
            >
              {round ? `${formatMinutes(item.msPlayed)} minutes` : item.subtitle}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Empty({ theme, children }: { theme: Theme; children: string }) {
  return <div style={{ display: "flex", marginTop: 120, fontSize: 48, color: theme.muted }}>{children}</div>;
}

export function renderShareCard(card: ShareCard, design: ShareDesign, host: string): ReactElement {
  const theme = THEMES[design];

  if (card.kind === "wrapped") {
    const photo = (theme.photo && card.artist?.imageUrl) || null;
    return (
      <Frame theme={theme} photo={photo} host={host} title={`My ${card.year} Wrapped`} subtitle={`${formatNumber(card.streams)} plays`}>
        <div style={{ display: "flex", flexDirection: "column", marginTop: photo ? 56 : 70 }}>
          <div style={{ display: "flex", fontSize: photo ? 170 : 190, lineHeight: 1, letterSpacing: -6 }}>
            {formatMinutes(card.msPlayed)}
          </div>
          <div style={{ display: "flex", fontSize: 46, color: theme.muted }}>
            {`minutes listened${card.genre ? ` · mostly ${card.genre}` : ""}`}
          </div>
        </div>
        {card.artist &&
          (photo ? (
            // The artist is already the picture at the top
            <div style={{ display: "flex", flexDirection: "column", marginTop: 56 }}>
              <div style={{ display: "flex", fontSize: 36, color: theme.accent }}>Top artist</div>
              <div style={{ display: "flex", fontSize: 64, lineHeight: 1.1 }}>{card.artist.name}</div>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 40, marginTop: 80 }}>
              <Picture theme={theme} src={card.artist.imageUrl} size={260} round label={card.artist.name} />
              <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", fontSize: 36, color: theme.accent }}>Top artist</div>
                <div style={{ display: "flex", fontSize: 72, lineHeight: 1.1 }}>{card.artist.name}</div>
              </div>
            </div>
          ))}
        {card.tracks.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: photo ? 12 : 18, marginTop: photo ? 56 : 80 }}>
            <div style={{ display: "flex", fontSize: 36, color: theme.accent }}>Top tracks</div>
            {card.tracks.map((track, index) => (
              <div key={track.id} style={{ display: "flex", gap: 24, fontSize: photo ? 42 : 46 }}>
                <span style={{ width: 44, color: theme.muted }}>{index + 1}</span>
                <span style={{ flex: 1, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{track.name}</span>
              </div>
            ))}
          </div>
        )}
      </Frame>
    );
  }

  const isArtists = card.kind === "top-artists";
  const photo = (theme.photo && card.items[0]?.imageUrl) || null;
  return (
    <Frame theme={theme} photo={photo} host={host} title={isArtists ? "My top artists" : "My top tracks"} subtitle={card.subtitle}>
      {card.items.length ? (
        <Ranking theme={theme} items={card.items} round={isArtists} compact={Boolean(photo)} />
      ) : (
        <Empty theme={theme}>No plays in this period yet.</Empty>
      )}
    </Frame>
  );
}
