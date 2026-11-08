import { ChartColumn, Check, Clock3, FileArchive, Flame, Gift, History, Share2, Tags, Trophy, Users } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { ArtTile, ellipsis, FeatureLayout, Panel, Picture, TIER_COLORS, TIER_NAMES, TrophyBadge } from "../components";
import { FRIEND_AVATARS, useData } from "../data";
import { C, DAYPARTS, EASE_OUT, fade, fmt, pop, ramp } from "../theme";
import T from "../timeline.json";

const TABS = ["Tracks", "Artists", "Albums", "Genres"];

type TopRow = { name: string; sub?: string; plays: number; minutes: number; image: string | null; hue: number };

// A genre has no picture: a colour tile with a tag on it
function GenreTile({ hue, size }: { hue: number; size: number }) {
  return (
    <span style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", width: size, height: size }}>
      <span style={{ position: "absolute", inset: 0 }}>
        <ArtTile hue={hue} size={size} round />
      </span>
      <Tags style={{ position: "relative", width: size * 0.42, height: size * 0.42, color: "rgba(255,255,255,0.9)" }} />
    </span>
  );
}

export function TopLists() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { topArtists, topAlbums, topGenres } = useData();
  const [first, second] = T.topList.switches;
  // The pill slides from Tracks to Artists, then on to Albums and Genres
  const tab = ramp(frame, 18, 34, EASE_OUT) + ramp(frame, first, first + 16, EASE_OUT) + ramp(frame, second, second + 16, EASE_OUT);
  const showing = frame >= second ? 2 : frame >= first ? 1 : 0;
  const lists: { word: string; shape: "round" | "square" | "genre"; rows: TopRow[]; start: number; end: number; stagger: number }[] = [
    { word: "artists", shape: "round", rows: topArtists, start: 30, end: first, stagger: 7 },
    { word: "albums", shape: "square", rows: topAlbums.map((album) => ({ ...album, sub: album.artist })), start: first + 6, end: second, stagger: 4 },
    { word: "genres", shape: "genre", rows: topGenres.map((genre) => ({ ...genre, image: null })), start: second + 6, end: Infinity, stagger: 4 },
  ];
  return (
    <FeatureLayout
      index={1}
      icon={ChartColumn}
      label="Top lists"
      title="Your top artists, albums and genres."
      accent={["top"]}
      body="Last month, last year, all time or any dates you pick. Every row shows plays and minutes."
    >
      <Panel style={{ width: 780 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 22 }}>
          <span style={{ fontSize: 32, fontWeight: 600 }}>Your top {lists[showing].word}</span>
          <span style={{ fontSize: 22, color: C.subtle }}>This year</span>
        </div>
        <div style={{ position: "relative", display: "flex", background: C.surface2, borderRadius: 999, padding: 6, marginBottom: 20 }}>
          <div
            style={{
              position: "absolute",
              top: 6,
              bottom: 6,
              left: 6,
              width: "calc((100% - 12px) / 4)",
              transform: `translateX(${tab * 100}%)`,
              background: C.surface3,
              borderRadius: 999,
            }}
          />
          {TABS.map((name, index) => (
            <span
              key={name}
              style={{
                position: "relative",
                flex: 1,
                textAlign: "center",
                fontSize: 22,
                fontWeight: 500,
                padding: "12px 0",
                color: Math.round(tab) === index ? C.foreground : C.muted,
              }}
            >
              {name}
            </span>
          ))}
        </div>
        {/* The lists sit on top of each other; one slides out as the next slides in */}
        <div style={{ position: "relative", height: 5 * 88 + 4 * 6 }}>
          {lists.map((list, listIndex) => {
            const max = Math.max(1, ...list.rows.map((row) => row.plays));
            return (
              <div key={list.word} style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                {list.rows.slice(0, 5).map((row, index) => {
                  const delay = list.start + index * list.stagger;
                  const enter = ramp(frame, delay - 4, delay + 10);
                  const exit = Number.isFinite(list.end) ? ramp(frame, list.end + index * 3, list.end + index * 3 + 10) : 0;
                  const visible = enter * (1 - exit);
                  if (visible <= 0) return <div key={row.name} style={{ height: 88, flexShrink: 0 }} />;
                  const bar = pop(frame, fps, delay, { damping: 26, stiffness: 60, mass: 1 });
                  const image = pop(frame, fps, delay + 6);
                  const count = ramp(frame, delay, delay + 50, EASE_OUT);
                  // The first list rises in; the next ones come in from the right
                  const shift = listIndex === 0 ? `translateY(${(1 - enter) * 24}px)` : `translateX(${(1 - enter) * 60}px)`;
                  return (
                    <div
                      key={row.name}
                      style={{
                        position: "relative",
                        display: "flex",
                        alignItems: "center",
                        gap: 20,
                        height: 88,
                        flexShrink: 0,
                        padding: "0 16px",
                        borderRadius: 22,
                        overflow: "hidden",
                        opacity: visible,
                        transform: `${shift} translateX(${-exit * 60}px)`,
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          top: 0,
                          bottom: 0,
                          left: 0,
                          width: `${(row.plays / max) * 100}%`,
                          background: "rgba(34,197,94,0.12)",
                          borderRadius: 22,
                          transformOrigin: "left",
                          transform: `scaleX(${bar})`,
                        }}
                      />
                      <span style={{ position: "relative", width: 28, textAlign: "right", fontSize: 24, color: C.subtle }}>{index + 1}</span>
                      <span style={{ position: "relative", transform: `scale(${image})` }}>
                        {list.shape === "genre" ? (
                          <GenreTile hue={row.hue} size={64} />
                        ) : (
                          <Picture image={row.image} hue={row.hue} size={64} round={list.shape === "round"} radius={12} />
                        )}
                      </span>
                      <span style={{ position: "relative", flex: 1, minWidth: 0 }}>
                        <span
                          style={{
                            display: "block",
                            fontSize: 28,
                            fontWeight: 500,
                            textTransform: list.shape === "genre" ? "capitalize" : undefined,
                            ...ellipsis,
                          }}
                        >
                          {row.name}
                        </span>
                        {row.sub && <span style={{ display: "block", fontSize: 20, color: C.subtle, ...ellipsis }}>{row.sub}</span>}
                      </span>
                      <span style={{ position: "relative", textAlign: "right", fontSize: 22, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                        <span style={{ display: "block", fontWeight: 500 }}>{fmt(row.plays * count)} plays</span>
                        <span style={{ display: "block", color: C.subtle }}>{fmt(row.minutes * count)} min</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </Panel>
    </FeatureLayout>
  );
}

const HEAT = [C.surface2, "#14432a", "#1a7040", "#22a556", "#6ee7a0"];

export function Activity() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { heat, hours, streak } = useData();
  const streakIn = pop(frame, fps, 84);
  const max = Math.max(1, ...hours);
  // Four shades by quartile, as on the site
  const positive = heat.filter((value) => value > 0).sort((a, b) => a - b);
  const thresholds = [0.25, 0.5, 0.75].map((q) => positive[Math.floor((positive.length - 1) * q)] ?? Infinity);
  return (
    <FeatureLayout
      flip
      index={2}
      icon={Clock3}
      label="Activity"
      title="See when you listen, not just what."
      accent={["when"]}
      body="A year of listening days at a glance, your streaks and the hours you play most."
    >
      <Panel style={{ width: 790 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 26 }}>
          <span style={{ fontSize: 32, fontWeight: 600 }}>Listening activity</span>
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 18px",
              borderRadius: 999,
              background: "rgba(34,197,94,0.15)",
              color: C.accent,
              fontSize: 22,
              fontWeight: 500,
              opacity: fade(streakIn),
              transform: `scale(${interpolate(streakIn, [0, 1], [0.6, 1])})`,
            }}
          >
            <Flame style={{ width: 24, height: 24 }} /> {streak}-day streak
          </span>
        </div>
        <div style={{ display: "grid", gridAutoFlow: "column", gridTemplateRows: "repeat(7, 25px)", gridAutoColumns: "25px", gap: 5 }}>
          {heat.map((value, index) => {
            const level = value <= 0 ? 0 : 1 + thresholds.filter((threshold) => value > threshold).length;
            const p = pop(frame, fps, 8 + Math.floor(index / 7) * 1.7 + (index % 7) * 1.1, { damping: 12, stiffness: 200, mass: 0.5 });
            return (
              <span
                key={index}
                style={{
                  borderRadius: 6,
                  background: value < 0 ? "transparent" : HEAT[level],
                  opacity: fade(p),
                  transform: `scale(${p})`,
                }}
              />
            );
          })}
        </div>
        <p style={{ margin: "30px 0 14px", fontSize: 22, color: C.subtle }}>By hour of day</p>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 7, height: 170 }}>
          {hours.map((value, hour) => {
            const p = pop(frame, fps, 40 + hour * 1.6, { damping: 16, stiffness: 120, mass: 0.7 });
            const part = [...DAYPARTS].reverse().find((daypart) => hour >= daypart.from)!;
            return (
              <span
                key={hour}
                style={{
                  flex: 1,
                  height: `${Math.max(2, (value / max) * 100)}%`,
                  borderRadius: "6px 6px 0 0",
                  background: part.color,
                  transformOrigin: "bottom",
                  transform: `scaleY(${p})`,
                }}
              />
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 26, marginTop: 18, fontSize: 20, color: C.muted }}>
          {DAYPARTS.map((part) => (
            <span key={part.label} style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span style={{ width: 12, height: 12, borderRadius: "50%", background: part.color }} />
              {part.label}
            </span>
          ))}
        </div>
      </Panel>
    </FeatureLayout>
  );
}

export function HistoryImport() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { imported, year, firstYear, playsByYear } = useData();
  const drop = pop(frame, fps, 4, { damping: 13, stiffness: 140, mass: 0.8 });
  const progress = ramp(frame, 26, 112, Easing.inOut(Easing.cubic));
  const done = pop(frame, fps, 114);
  const maxPlays = Math.max(1, ...playsByYear);
  const span = Math.max(1, playsByYear.length - 1);
  return (
    <FeatureLayout
      index={3}
      icon={History}
      label="Import"
      title="Every play, back to your very first."
      accent={["first"]}
      body="Upload your Spotify history once and every stat goes back years. It's read in your browser."
    >
      <Panel style={{ width: 770 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 22,
            padding: 22,
            borderRadius: 28,
            background: C.surface2,
            opacity: fade(drop),
            transform: `translateY(${(1 - drop) * -90}px)`,
          }}
        >
          <span
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 76,
              height: 76,
              borderRadius: 20,
              background: "rgba(34,197,94,0.15)",
              color: C.accent,
            }}
          >
            <FileArchive style={{ width: 38, height: 38 }} />
          </span>
          <span>
            <span style={{ display: "block", fontSize: 28, fontWeight: 600 }}>my_spotify_data.zip</span>
            <span style={{ display: "block", fontSize: 22, color: C.subtle }}>Extended streaming history</span>
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "30px 0 14px", fontSize: 22 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 10, color: done > 0.01 ? C.accent : C.muted }}>
            {done > 0.01 && (
              <span
                style={{
                  display: "flex",
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  alignItems: "center",
                  justifyContent: "center",
                  background: C.accentFill,
                  color: C.accentForeground,
                  transform: `scale(${done})`,
                }}
              >
                <Check style={{ width: 20, height: 20 }} strokeWidth={3} />
              </span>
            )}
            {done > 0.01 ? "Imported" : "Importing…"}
          </span>
          <span style={{ color: C.muted, fontVariantNumeric: "tabular-nums" }}>{Math.round(progress * 100)}%</span>
        </div>
        <div style={{ height: 14, borderRadius: 7, background: C.surface3, overflow: "hidden" }}>
          <div
            style={{
              width: `${progress * 100}%`,
              height: "100%",
              borderRadius: 7,
              background: C.accentFill,
              boxShadow: "0 0 24px rgba(34,197,94,0.7)",
            }}
          />
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 26 }}>
          {[
            { label: "Plays imported", value: fmt(imported * progress), color: C.foreground },
            { label: "Going back to", value: String(Math.round(year - (year - firstYear) * progress)), color: C.accent },
          ].map((stat) => (
            <div key={stat.label} style={{ flex: 1, padding: 24, borderRadius: 24, background: C.surface2 }}>
              <div style={{ fontSize: 22, color: C.muted }}>{stat.label}</div>
              <div style={{ fontSize: 54, fontWeight: 600, letterSpacing: "-0.03em", color: stat.color, fontVariantNumeric: "tabular-nums" }}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 120, marginTop: 28 }}>
          {playsByYear.map((plays, index) => {
            // The newest year fills first
            const reached = (playsByYear.length - 1 - index) / span;
            const p = pop(frame, fps, 26 + reached * 84, { damping: 14, stiffness: 150, mass: 0.6 });
            const last = index === playsByYear.length - 1;
            return (
              <div
                key={index}
                style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, height: "100%", justifyContent: "flex-end" }}
              >
                <span
                  style={{
                    width: "100%",
                    height: `${Math.max(3, (plays / maxPlays) * 78)}%`,
                    borderRadius: 8,
                    background: last ? C.accent : "rgba(74,222,128,0.45)",
                    transformOrigin: "bottom",
                    transform: `scaleY(${p})`,
                  }}
                />
                <span style={{ fontSize: 16, color: C.subtle, opacity: fade(p) }}>’{String(firstYear + index).slice(2)}</span>
              </div>
            );
          })}
        </div>
      </Panel>
    </FeatureLayout>
  );
}

function Pulse() {
  const frame = useCurrentFrame();
  const cycle = (frame % 60) / 60;
  return (
    <span style={{ position: "relative", display: "inline-flex", width: 14, height: 14 }}>
      <span
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: C.accent,
          opacity: 0.6 * (1 - cycle),
          transform: `scale(${1 + cycle * 1.6})`,
        }}
      />
      <span style={{ position: "relative", width: 14, height: 14, borderRadius: "50%", background: C.accent }} />
    </span>
  );
}

function Equalizer({ seed }: { seed: number }) {
  const frame = useCurrentFrame();
  return (
    <span style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 40, flexShrink: 0 }}>
      {[0, 1, 2, 3].map((bar) => {
        const level = 0.25 + 0.75 * Math.abs(Math.sin(frame * 0.11 + bar * 1.7 + seed) * Math.cos(frame * 0.05 + bar));
        return <span key={bar} style={{ width: 7, height: `${level * 100}%`, borderRadius: 4, background: C.accent }} />;
      })}
    </span>
  );
}

export function Friends() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { friends, tasteMatch, topArtists } = useData();
  const match = pop(frame, fps, 40, { damping: 18, stiffness: 110, mass: 0.8 });
  const fill = (ramp(frame, 48, 118, EASE_OUT) * tasteMatch) / 100;
  const shared = [topArtists[0], topArtists[2] ?? topArtists[1]].filter(Boolean).map((artist) => artist.name);
  return (
    <FeatureLayout
      flip
      index={4}
      icon={Users}
      label="Friends"
      title="See what your friends play, live."
      accent={["live"]}
      body="Live listening, taste match, and who plays an artist the most. You choose who sees what."
    >
      <Panel style={{ width: 760, display: "flex", flexDirection: "column", gap: 16 }}>
        {friends.map((friend, index) => {
          const p = pop(frame, fps, 6 + index * 12, { damping: 16, stiffness: 130, mass: 0.7 });
          return (
            <div
              key={friend.name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 22,
                padding: 22,
                borderRadius: 28,
                background: C.surface2,
                opacity: fade(p),
                transform: `translateX(${(1 - p) * 80}px)`,
              }}
            >
              <span style={{ flexShrink: 0, borderRadius: "50%", boxShadow: "0 0 0 3px rgba(255,255,255,0.08)" }}>
                <Picture image={friend.avatar ?? FRIEND_AVATARS[index % FRIEND_AVATARS.length]} hue={friend.hue} size={76} round />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 22, color: C.muted }}>
                  <Pulse /> {friend.name} is listening to
                </span>
                <span style={{ display: "block", fontSize: 30, fontWeight: 600, marginTop: 2, ...ellipsis }}>{friend.track.name}</span>
                <span style={{ display: "block", fontSize: 22, color: C.subtle, ...ellipsis }}>{friend.track.artist}</span>
              </span>
              <Equalizer seed={index * 2} />
              <span style={{ transform: `rotate(${frame * 1.2}deg)`, flexShrink: 0 }}>
                <Picture image={friend.track.image} hue={friend.track.hue} size={76} round />
              </span>
            </div>
          );
        })}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 28,
            padding: 26,
            borderRadius: 28,
            background: "rgba(34,197,94,0.1)",
            opacity: fade(match),
            transform: `translateY(${(1 - match) * 40}px)`,
          }}
        >
          <span
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 150,
              height: 150,
              flexShrink: 0,
              borderRadius: "50%",
              background: `conic-gradient(${C.accent} ${fill * 360}deg, ${C.surface3} 0deg)`,
            }}
          >
            <span
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 120,
                height: 120,
                borderRadius: "50%",
                background: "#13241b",
                fontSize: 42,
                fontWeight: 600,
                letterSpacing: "-0.03em",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {Math.round(fill * 100)}%
            </span>
          </span>
          <span>
            <span style={{ display: "block", fontSize: 32, fontWeight: 600 }}>Taste match with {friends[0]?.name}</span>
            <span style={{ display: "block", fontSize: 22, color: C.muted, marginTop: 6, lineHeight: 1.4 }}>
              You both play {shared.join(" and ")}.
            </span>
          </span>
        </div>
      </Panel>
    </FeatureLayout>
  );
}

// A ring and sparks flying out of a badge that just went up a tier; `age` is frames since
function Burst({ age, color }: { age: number; color: string }) {
  const t = age / 40;
  return (
    <span style={{ position: "absolute", left: "50%", top: "50%", width: 0, height: 0 }}>
      <span
        style={{
          position: "absolute",
          left: -46,
          top: -46,
          width: 92,
          height: 92,
          borderRadius: "50%",
          border: `3px solid ${color}`,
          opacity: (1 - t) * 0.9,
          transform: `scale(${0.6 + t * 1.4})`,
        }}
      />
      {Array.from({ length: 8 }, (_, index) => {
        const angle = (index / 8) * Math.PI * 2 + 0.3;
        const distance = 30 + t * 64;
        return (
          <span
            key={index}
            style={{
              position: "absolute",
              left: Math.cos(angle) * distance - 4,
              top: Math.sin(angle) * distance - 4,
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: color,
              opacity: 1 - t,
              transform: `scale(${1 - t * 0.5})`,
            }}
          />
        );
      })}
    </span>
  );
}

export function Trophies() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { level, trophies } = useData();
  const [firstUp, secondUp] = T.trophies.upgrades;
  const levelIn = pop(frame, fps, 4, { damping: 18, stiffness: 120, mass: 0.8 });
  const ring = ramp(frame, 10, 90, EASE_OUT) * level.progress;
  return (
    <FeatureLayout
      index={5}
      icon={Trophy}
      label="Levels & trophies"
      title="Level up just by listening."
      accent={["Level", "up"]}
      body="From bedroom listener to legend, plus bronze, silver and gold trophies for night owls, marathons and more."
    >
      <Panel style={{ width: 760 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 28,
            padding: 24,
            borderRadius: 28,
            background: C.surface2,
            opacity: fade(levelIn),
            transform: `translateY(${(1 - levelIn) * 40}px)`,
          }}
        >
          <span
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 140,
              height: 140,
              flexShrink: 0,
              borderRadius: "50%",
              background: `conic-gradient(${C.accent} ${ring * 360}deg, ${C.surface3} 0deg)`,
            }}
          >
            <span
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                width: 112,
                height: 112,
                borderRadius: "50%",
                background: C.surface2,
              }}
            >
              <span style={{ fontSize: 46, fontWeight: 600, lineHeight: 1 }}>{level.level}</span>
              <span style={{ fontSize: 17, color: C.subtle, marginTop: 4 }}>level</span>
            </span>
          </span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 22, color: C.muted }}>Your level</span>
            <span style={{ display: "block", fontSize: 40, fontWeight: 600, letterSpacing: "-0.02em" }}>{level.title}</span>
            <span style={{ display: "block", fontSize: 22, color: C.subtle }}>
              {level.toNext === null ? "The top level. Nothing left to prove." : `${fmt(level.toNext)} minutes to level ${level.level + 1}`}
            </span>
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginTop: 18 }}>
          {trophies.map((trophy, index) => {
            const p = pop(frame, fps, 30 + index * 7, { damping: 11, stiffness: 150, mass: 0.7 });
            // The first gold trophy climbs from bronze while you watch
            const climbs = index === 0 && trophy.tier === 3;
            const tier = climbs ? (frame < firstUp ? 1 : frame < secondUp ? 2 : 3) : trophy.tier;
            const age = climbs ? Math.min(...[firstUp, secondUp].map((up) => frame - up).filter((since) => since >= 0)) : Infinity;
            const kick = age < 40 ? 0.35 * Math.exp(-age / 6) : 0;
            const shine = !climbs && tier === 3 ? Math.max(0, 1 - Math.abs(frame - (140 + index * 6)) / 10) : 0;
            return (
              <div
                key={trophy.name}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 10,
                  padding: "20px 10px 18px",
                  borderRadius: 26,
                  background: C.surface2,
                  opacity: fade(p),
                }}
              >
                <span
                  style={{
                    position: "relative",
                    transform: `scale(${p * (1 + kick)}) rotate(${(1 - p) * -40}deg)`,
                    filter: `brightness(${1 + shine * 0.6 + kick * 1.5})`,
                  }}
                >
                  <TrophyBadge icon={trophy.icon} tier={tier} size={92} />
                  {age < 40 && <Burst age={age} color={TIER_COLORS[tier - 1]} />}
                </span>
                <span style={{ fontSize: 22, fontWeight: 500, color: tier ? C.foreground : C.muted }}>{trophy.name}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 10, transform: `scale(${1 + kick * 0.6})` }}>
                  <span style={{ display: "flex", gap: 5 }}>
                    {TIER_COLORS.map((color, dot) => (
                      <span key={color} style={{ width: 10, height: 10, borderRadius: "50%", background: dot < tier ? color : C.surface3 }} />
                    ))}
                  </span>
                  <span style={{ fontSize: 18, fontWeight: 600, color: tier ? TIER_COLORS[tier - 1] : C.subtle }}>
                    {tier ? TIER_NAMES[tier - 1] : "Locked"}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      </Panel>
    </FeatureLayout>
  );
}

function ShareCard({ from, children, style }: { from: string; children?: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        position: "absolute",
        width: 420,
        height: 740,
        borderRadius: 48,
        padding: 40,
        background: `linear-gradient(180deg, ${from}, ${C.background} 78%)`,
        border: `1.5px solid ${C.borderStrong}`,
        boxShadow: "0 60px 120px -30px rgba(0,0,0,0.8)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Wrapped() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const data = useData();
  const mostPlayed = data.topArtists[0] ?? data.wrappedArtist;
  const fan = pop(frame, fps, 70, { damping: 16, stiffness: 90, mass: 0.9 });
  const minutes = ramp(frame, 14, 92, EASE_OUT);
  const float = Math.sin(frame / 28) * 10;
  const genre = data.topGenre ? data.topGenre[0].toUpperCase() + data.topGenre.slice(1) : null;
  return (
    <FeatureLayout
      flip
      index={6}
      icon={Gift}
      label="Wrapped"
      title="Wrapped, whenever you want it."
      accent={["whenever"]}
      body="Your year in music any day of the year, ready to share to your story in one tap."
    >
      <div style={{ position: "relative", width: 700, height: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <ShareCard
          from="#2b1a55"
          style={{ opacity: fade(fan), transform: `translateX(${-fan * 235}px) rotate(${-fan * 10}deg) scale(0.9)` }}
        >
          <div style={{ fontSize: 22, color: "#b4a5ff" }}>stats.lk</div>
          <div style={{ fontSize: 30, fontWeight: 600, marginTop: 30 }}>My top 5 artists</div>
          {data.topArtists.map((artist, index) => (
            <div key={artist.name} style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 22 }}>
              <Picture image={artist.image} hue={artist.hue} size={56} round />
              <span style={{ fontSize: 22, fontWeight: 500, ...ellipsis }}>
                {index + 1}. {artist.name}
              </span>
            </div>
          ))}
        </ShareCard>
        {/* Only its right side shows, so the content sits there */}
        <ShareCard
          from="#5a2a12"
          style={{
            opacity: fade(fan),
            transform: `translateX(${fan * 235}px) rotate(${fan * 10}deg) scale(0.9)`,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            textAlign: "right",
          }}
        >
          <div style={{ fontSize: 22, color: "#ffb48a" }}>stats.lk</div>
          <div style={{ marginTop: 60 }}>
            <Picture image={mostPlayed.image} hue={mostPlayed.hue} size={170} round />
          </div>
          <div style={{ fontSize: 22, color: "#ffb48a", marginTop: 36 }}>Most played</div>
          <div style={{ maxWidth: 200, fontSize: 34, fontWeight: 600, lineHeight: 1.1, marginTop: 4 }}>{mostPlayed.name}</div>
          <div style={{ fontSize: 24, color: C.muted, marginTop: 10 }}>{fmt(mostPlayed.plays)} plays</div>
          {genre && (
            <>
              <div style={{ fontSize: 22, color: "#ffb48a", marginTop: 36 }}>Top genre</div>
              <div style={{ maxWidth: 200, fontSize: 34, fontWeight: 600, lineHeight: 1.1 }}>{genre}</div>
            </>
          )}
        </ShareCard>
        <ShareCard from="#0f3d22" style={{ transform: `translateY(${float}px)` }}>
          <div style={{ fontSize: 22, color: C.accent, fontWeight: 500 }}>stats.lk</div>
          <div style={{ fontSize: 36, fontWeight: 600, marginTop: 36 }}>{data.year} on stats.lk</div>
          <div
            style={{
              fontSize: data.minutes >= 100_000 ? 80 : 96,
              fontWeight: 600,
              letterSpacing: "-0.045em",
              lineHeight: 1,
              marginTop: 30,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {fmt(data.minutes * minutes)}
          </div>
          <div style={{ fontSize: 24, color: C.muted, marginTop: 6 }}>minutes listened</div>
          <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 40 }}>
            <Picture image={data.wrappedArtist.image} hue={data.wrappedArtist.hue} size={80} round />
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 20, color: C.accent }}>Top artist</span>
              <span style={{ display: "block", fontSize: 30, fontWeight: 600, ...ellipsis }}>{data.wrappedArtist.name}</span>
            </span>
          </div>
          <div style={{ marginTop: 30 }}>
            {data.topTracks.slice(0, 3).map((track, index) => {
              const p = ramp(frame, 40 + index * 8, 60 + index * 8);
              return (
                <div key={track.name} style={{ display: "flex", gap: 16, fontSize: 24, marginTop: 12, opacity: p, transform: `translateX(${(1 - p) * 30}px)` }}>
                  <span style={{ color: C.subtle, width: 18, flexShrink: 0 }}>{index + 1}</span>
                  <span style={{ fontWeight: 500, ...ellipsis }}>{track.name}</span>
                </div>
              );
            })}
          </div>
          <div style={{ position: "absolute", left: 40, bottom: 36, display: "flex", alignItems: "center", gap: 10, fontSize: 20, color: C.subtle }}>
            <Share2 style={{ width: 22, height: 22 }} /> Share to your story
          </div>
        </ShareCard>
      </div>
    </FeatureLayout>
  );
}
