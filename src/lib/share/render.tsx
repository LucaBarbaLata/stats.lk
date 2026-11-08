import type { CSSProperties, ReactElement, ReactNode } from "react";
import {
  planStats,
  type RankingLayout,
  type ShareConfig,
  type ShareData,
  type ShareItem,
  type StatRow,
  type StatValue,
  type SummaryLayout,
} from "./options";
import { THEMES, type Theme } from "./themes";

// Draws a share card (1080x1920) for Satori, from content loaded by
// ./data.ts. Satori needs display: flex on every element with several
// children, has no grid, and only knows the font next/og ships (Geist
// Regular).

export const SHARE_SIZE = { width: 1080, height: 1920 };

const WIDTH = 900; // inside the side padding
const TITLE_TOP = 56;
const POSTER_TITLE_TOP = 420;

const ellipsis: CSSProperties = { overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" };

// A font size at which `text` fits on one line `width` pixels wide
function fit(text: string, width: number, max: number, min = 44): number {
  return Math.max(min, Math.min(max, Math.floor(width / (Math.max(text.length, 1) * 0.58))));
}

// ------------------------------------------------------------------ pieces

function Wordmark({ theme, overPhoto }: { theme: Theme; overPhoto: boolean }) {
  const [fill, bars] = theme.mark;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 18,
        fontSize: 42,
        color: theme.text,
        ...(overPhoto && { textShadow: `0 2px 18px ${theme.glow}` }),
      }}
    >
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

function Picture({
  theme,
  src,
  size,
  round,
  label,
  height = size,
}: {
  theme: Theme;
  src: string | null;
  size: number;
  round?: boolean;
  label: string;
  height?: number;
}) {
  const radius = round ? size / 2 : Math.round(size / 10);
  if (!src) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          width: size,
          height,
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
  return (
    // eslint-disable-next-line @next/next/no-img-element -- Satori renders plain <img>
    <img
      src={src}
      alt=""
      width={size}
      height={height}
      style={{ flexShrink: 0, borderRadius: radius, objectFit: "cover", ...(theme.imageFilter && { filter: theme.imageFilter }) }}
    />
  );
}

// The top picture, blurred, behind the whole card (Blur theme)
function Backdrop({ src }: { src: string }) {
  return (
    <div style={{ position: "absolute", top: 0, left: 0, width: 1080, height: 1920, display: "flex", overflow: "hidden" }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- Satori renders plain <img> */}
      <img
        src={src}
        alt=""
        width={2240}
        height={2240}
        style={{ position: "absolute", top: -160, left: -580, filter: "blur(70px) saturate(1.3)" }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 1080,
          height: 1920,
          backgroundImage: "linear-gradient(180deg, rgba(10,10,14,0.3) 0%, rgba(10,10,14,0.5) 45%, rgba(10,10,14,0.75) 100%)",
        }}
      />
    </div>
  );
}

// A picture across the top that fades into the background (Poster layouts),
// shaded at the top so the logo stays readable
function Hero({ theme, src }: { theme: Theme; src: string }) {
  return (
    <div style={{ position: "absolute", top: 0, left: 0, width: 1080, height: 1080, display: "flex" }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- Satori renders plain <img> */}
      <img
        src={src}
        alt=""
        width={1080}
        height={1080}
        style={{
          objectFit: "cover",
          maskImage: "linear-gradient(180deg, black 0%, black 35%, transparent 88%)",
          ...(theme.imageFilter && { filter: theme.imageFilter }),
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 1080,
          height: 420,
          backgroundImage: `linear-gradient(180deg, ${theme.glow} 0%, transparent 100%)`,
        }}
      />
    </div>
  );
}

function Frame({
  theme,
  title,
  subtitle,
  host,
  backdrop,
  hero,
  children,
}: {
  theme: Theme;
  title: string;
  subtitle: string;
  host: string;
  backdrop: string | null;
  hero: string | null;
  children: ReactNode;
}) {
  const overPhoto = Boolean(hero || backdrop);
  const titleSize = title.length <= 17 ? 92 : title.length <= 22 ? 76 : title.length <= 28 ? 62 : 52;
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
      {backdrop && <Backdrop src={backdrop} />}
      {hero && <Hero theme={theme} src={hero} />}
      <Wordmark theme={theme} overPhoto={overPhoto} />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          marginTop: hero ? POSTER_TITLE_TOP : TITLE_TOP,
          ...(overPhoto && { textShadow: `0 0 28px ${theme.glow}, 0 2px 6px ${theme.glow}` }),
        }}
      >
        <div style={{ display: "flex", fontSize: titleSize, lineHeight: 1.05, letterSpacing: -2, ...ellipsis }}>{title}</div>
        <div style={{ display: "flex", fontSize: 44, color: theme.muted, marginTop: 18 }}>{subtitle}</div>
      </div>
      {children}
      <div style={{ display: "flex", marginTop: "auto", fontSize: 34, color: theme.muted }}>{host}</div>
    </div>
  );
}

function Empty({ theme, children }: { theme: Theme; children: string }) {
  return <div style={{ display: "flex", marginTop: 120, fontSize: 48, color: theme.muted }}>{children}</div>;
}

function Lines({ theme, name, subtitle, size, center }: { theme: Theme; name: string; subtitle: string; size: number; center?: boolean }) {
  const align: CSSProperties = center ? { justifyContent: "center", textAlign: "center" } : {};
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", fontSize: size, lineHeight: 1.15, ...align, ...ellipsis }}>{name}</div>
      {subtitle && (
        <div style={{ display: "flex", fontSize: Math.round(size * 0.66), color: theme.muted, marginTop: 4, ...align, ...ellipsis }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------- top lists

type RankingProps = { theme: Theme; items: ShareItem[]; round: boolean };

function Rows({ theme, items, round, picture, gap, offset = 0 }: RankingProps & { picture: number; gap: number; offset?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap }}>
      {items.map((item, index) => (
        <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 36 }}>
          <div style={{ display: "flex", width: 56, fontSize: picture > 150 ? 52 : 44, color: theme.muted }}>{offset + index + 1}</div>
          <Picture theme={theme} src={item.imageUrl} size={picture} round={round} label={item.name} />
          <Lines theme={theme} name={item.name} subtitle={item.subtitle} size={picture > 150 ? 54 : 46} />
        </div>
      ))}
    </div>
  );
}

function Grid({ theme, items, round }: RankingProps) {
  const cell = 280;
  const rows = [items.slice(0, 3), items.slice(3, 6), items.slice(6, 9)].filter((row) => row.length);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 44, marginTop: 70 }}>
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} style={{ display: "flex", gap: (WIDTH - cell * 3) / 2 }}>
          {row.map((item, index) => (
            <div key={item.id} style={{ display: "flex", flexDirection: "column", width: cell, position: "relative" }}>
              <Picture theme={theme} src={item.imageUrl} size={cell} round={round} label={item.name} />
              <div
                style={{
                  position: "absolute",
                  top: round ? 6 : 14,
                  left: round ? 6 : 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 60,
                  height: 60,
                  borderRadius: 30,
                  backgroundColor: theme.background,
                  color: theme.text,
                  fontSize: 30,
                }}
              >
                {rowIndex * 3 + index + 1}
              </div>
              <div style={{ display: "flex", marginTop: 16 }}>
                <Lines theme={theme} name={item.name} subtitle={item.subtitle} size={32} />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function Podium({ theme, items, round }: RankingProps) {
  const column = 280;
  // Second, first, third, like a real podium
  const places = [
    { item: items[1], rank: 2, picture: 220, step: 190 },
    { item: items[0], rank: 1, picture: 280, step: 260 },
    { item: items[2], rank: 3, picture: 220, step: 140 },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", marginTop: 90 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: (WIDTH - column * 3) / 2 }}>
        {places.map(({ item, rank, picture, step }) => (
          <div key={rank} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: column }}>
            {/* Separate elements, not a fragment: Satori lays a fragment's children out side by side */}
            {item && <Picture theme={theme} src={item.imageUrl} size={picture} round={round} label={item.name} />}
            {item && (
              <div style={{ display: "flex", width: column, marginTop: 18 }}>
                <Lines theme={theme} name={item.name} subtitle={item.subtitle} size={rank === 1 ? 38 : 34} center />
              </div>
            )}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                width: column,
                height: step,
                marginTop: 20,
                paddingTop: 22,
                borderRadius: "28px 28px 0 0",
                backgroundColor: theme.surface,
                fontSize: rank === 1 ? 110 : 84,
                lineHeight: 1,
                color: rank === 1 ? theme.accent : theme.muted,
              }}
            >
              {rank}
            </div>
          </div>
        ))}
      </div>
      {items.length > 3 && (
        <div style={{ display: "flex", flexDirection: "column", marginTop: 60 }}>
          <Rows theme={theme} items={items.slice(3)} round={round} picture={120} gap={24} offset={3} />
        </div>
      )}
    </div>
  );
}

// No pictures, just big type
function TypeList({ theme, items }: RankingProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 64 }}>
      {items.map((item, index) => (
        <div key={item.id} style={{ display: "flex", alignItems: "baseline", gap: 24 }}>
          <div style={{ display: "flex", width: 76, fontSize: 40, color: index === 0 ? theme.accent : theme.muted }}>
            {String(index + 1).padStart(2, "0")}
          </div>
          <Lines theme={theme} name={item.name} subtitle={item.subtitle} size={index === 0 ? 60 : 50} />
        </div>
      ))}
    </div>
  );
}

function renderRanking(data: Extract<ShareData, { kind: "ranking" }>, layout: RankingLayout, theme: Theme, host: string) {
  const top = data.items[0]?.imageUrl ?? null;
  const props = { theme, items: data.items, round: data.round };
  const body = !data.items.length ? (
    <Empty theme={theme}>No plays in this period yet.</Empty>
  ) : layout === "grid" ? (
    <Grid {...props} />
  ) : layout === "podium" ? (
    <Podium {...props} />
  ) : layout === "type" ? (
    <TypeList {...props} />
  ) : (
    <div style={{ display: "flex", flexDirection: "column", marginTop: layout === "poster" ? 70 : 90 }}>
      <Rows {...props} picture={layout === "poster" ? 128 : 180} gap={layout === "poster" ? 28 : 40} />
    </div>
  );
  return (
    <Frame
      theme={theme}
      title={data.title}
      subtitle={data.subtitle}
      host={host}
      backdrop={theme.backdrop ? top : null}
      hero={layout === "poster" ? top : null}
    >
      {body}
    </Frame>
  );
}

// ------------------------------------------------------------ stat cards

type Summary = Extract<ShareData, { kind: "summary" }>;

// Sizes per layout: the stat rows' spacing and their pieces
const SUMMARY_SIZES: Record<SummaryLayout, { gap: number; first: number; number: number; picture: number; listPicture: number }> = {
  stack: { gap: 48, first: 48, number: 150, picture: 200, listPicture: 72 },
  tiles: { gap: 24, first: 56, number: 120, picture: 160, listPicture: 60 },
  poster: { gap: 44, first: 44, number: 120, picture: 150, listPicture: 56 },
};

function NumberStat({ theme, stat, width, max }: { theme: Theme; stat: Extract<StatValue, { kind: "number" }>; width: number; max: number }) {
  const size = fit(stat.value, width, max);
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", fontSize: size, lineHeight: 1, letterSpacing: -Math.round(size * 0.03), ...ellipsis }}>
        {stat.value}
      </div>
      <div style={{ display: "flex", fontSize: 38, color: theme.muted, marginTop: 12, ...ellipsis }}>{stat.label}</div>
    </div>
  );
}

function FeatureStat({
  theme,
  stat,
  picture,
  withPicture,
}: {
  theme: Theme;
  stat: Extract<StatValue, { kind: "feature" }>;
  picture: number;
  withPicture: boolean;
}) {
  const name = stat.item?.name ?? "–";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
      {withPicture && <Picture theme={theme} src={stat.item?.imageUrl ?? null} size={picture} round={stat.round} label={name} />}
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", fontSize: 36, color: theme.accent }}>{stat.label}</div>
        <div style={{ display: "flex", fontSize: 64, lineHeight: 1.1, ...ellipsis }}>{name}</div>
        {withPicture && (
          <div style={{ display: "flex", fontSize: 36, color: theme.muted, marginTop: 4, ...ellipsis }}>
            {stat.item?.subtitle ?? "No plays yet"}
          </div>
        )}
      </div>
    </div>
  );
}

function ListStat({ theme, stat, picture }: { theme: Theme; stat: Extract<StatValue, { kind: "list" }>; picture: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", fontSize: 36, color: theme.accent, marginBottom: 18 }}>{stat.label}</div>
      {stat.items.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {stat.items.map((item, index) => (
            <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 24 }}>
              <div style={{ display: "flex", width: 40, fontSize: 34, color: theme.muted }}>{index + 1}</div>
              <Picture theme={theme} src={item.imageUrl} size={picture} round={stat.round} label={item.name} />
              <Lines theme={theme} name={item.name} subtitle={item.subtitle} size={picture > 64 ? 40 : 36} />
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", fontSize: 38, color: theme.muted }}>No plays yet</div>
      )}
    </div>
  );
}

function StatRowView({ theme, data, row, layout }: { theme: Theme; data: Summary; row: StatRow; layout: SummaryLayout }) {
  const sizes = SUMMARY_SIZES[layout];
  const tile = layout === "tiles";
  const tileStyle: CSSProperties = { display: "flex", borderRadius: 36, backgroundColor: theme.surface, padding: row.kind === "feature" ? 32 : 36 };

  if (row.kind === "numbers") {
    const gap = tile ? 24 : 40;
    const cellWidth = (WIDTH - gap * (row.stats.length - 1)) / row.stats.length - (tile ? 72 : 0);
    return (
      <div style={{ display: "flex", gap }}>
        {row.stats.map((key) => {
          const stat = data.values[key];
          if (stat?.kind !== "number") return null;
          const view = <NumberStat theme={theme} stat={stat} width={cellWidth} max={row.stats.length === 1 ? sizes.number : sizes.number - 20} />;
          // A fixed width: Satori's flex: 1 still sizes cells by their content
          const width = (WIDTH - gap * (row.stats.length - 1)) / row.stats.length;
          return (
            <div key={key} style={{ ...(tile ? tileStyle : { display: "flex" }), width, flexShrink: 0 }}>
              {view}
            </div>
          );
        })}
      </div>
    );
  }

  const stat = data.values[row.stats[0]];
  if (!stat) return null;
  const view =
    stat.kind === "feature" ? (
      <FeatureStat
        theme={theme}
        stat={stat}
        picture={sizes.picture}
        // On a poster, the top artist already is the big picture
        withPicture={!(layout === "poster" && row.stats[0] === "top-artist" && data.picture)}
      />
    ) : stat.kind === "list" ? (
      <ListStat theme={theme} stat={stat} picture={sizes.listPicture} />
    ) : null;
  return tile ? <div style={{ ...tileStyle, flexDirection: "column" }}>{view}</div> : <div style={{ display: "flex", flexDirection: "column" }}>{view}</div>;
}

function renderSummary(data: Summary, layout: SummaryLayout, theme: Theme, host: string) {
  const sizes = SUMMARY_SIZES[layout];
  const hero = layout === "poster" ? data.picture : null;
  const { rows } = planStats(layout, data.stats);
  return (
    <Frame
      theme={theme}
      title={data.title}
      subtitle={data.subtitle}
      host={host}
      backdrop={theme.backdrop ? data.picture : null}
      hero={hero}
    >
      {rows.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: sizes.gap, marginTop: sizes.first }}>
          {rows.map((row) => (
            <StatRowView key={row.stats.join()} theme={theme} data={data} row={row} layout={layout} />
          ))}
        </div>
      ) : (
        <Empty theme={theme}>Pick some stats to show.</Empty>
      )}
    </Frame>
  );
}

export function renderShareCard(data: ShareData, config: Pick<ShareConfig, "layout" | "theme">, host: string): ReactElement {
  const theme = THEMES[config.theme];
  return data.kind === "ranking"
    ? renderRanking(data, config.layout as RankingLayout, theme, host)
    : renderSummary(data, config.layout as SummaryLayout, theme, host);
}
