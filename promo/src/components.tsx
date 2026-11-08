import {
  CalendarDays,
  Compass,
  Crown,
  Disc3,
  Flame,
  Handshake,
  Headphones,
  Heart,
  History,
  Hourglass,
  Layers,
  Library,
  Moon,
  Repeat,
  Shapes,
  Sparkles,
  Star,
  Sunrise,
  Timer,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Fragment, type CSSProperties, type ReactNode } from "react";
import { AbsoluteFill, Easing, Img, interpolate, random, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { TrophyIcon } from "./data";
import { C, EASE_OUT, fade, pop, ramp, useVertical } from "./theme";
import T from "./timeline.json";

export function Panel({ children, style }: { children?: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        background: C.surface,
        border: `1.5px solid ${C.border}`,
        borderRadius: 40,
        padding: 36,
        boxShadow: "0 50px 120px -30px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.04)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// A cover made of colour, standing in for album art (as on the landing page)
export function ArtTile({ hue, size, round, radius = 14 }: { hue: number; size: number; round?: boolean; radius?: number }) {
  return (
    <span
      style={{
        display: "block",
        flexShrink: 0,
        width: size,
        height: size,
        borderRadius: round ? "50%" : radius,
        background: `radial-gradient(circle at 30% 25%, hsl(${hue} 80% 70%), hsl(${hue + 30} 60% 38%) 55%, hsl(${hue + 50} 55% 16%))`,
      }}
    />
  );
}

// A real picture from public/, or a colour tile when there is none
export function Picture({ image, hue, size, round, radius = 14 }: { image: string | null; hue: number; size: number; round?: boolean; radius?: number }) {
  if (!image) return <ArtTile hue={hue} size={size} round={round} radius={radius} />;
  return (
    <Img
      src={staticFile(image)}
      style={{ display: "block", flexShrink: 0, width: size, height: size, borderRadius: round ? "50%" : radius, objectFit: "cover" }}
    />
  );
}

// One line, cut with an ellipsis when it doesn't fit
export const ellipsis: CSSProperties = { minWidth: 0, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" };

// The stats.lk mark; `bars` scales each bar of the level meter from its foot
export function LogoMark({ size, bars = [1, 1, 1] }: { size: number; bars?: number[] }) {
  const bar = (x: number, y: number, h: number, opacity: number, scale: number) => (
    <rect
      x={x}
      y={y}
      width={4}
      height={h}
      rx={2}
      fill={C.accentForeground}
      opacity={opacity}
      transform={`translate(0 24) scale(1 ${Math.max(0, scale)}) translate(0 -24)`}
    />
  );
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} style={{ display: "block", overflow: "visible" }}>
      <rect width="32" height="32" rx="9" fill={C.accentFill} />
      {bar(8, 15, 9, 0.7, bars[0])}
      {bar(14, 8, 16, 1, bars[1])}
      {bar(20, 12, 12, 0.85, bars[2])}
    </svg>
  );
}

export function Wordmark({ size }: { size: number }) {
  return (
    <span style={{ fontSize: size, fontWeight: 600, letterSpacing: "-0.045em", lineHeight: 1 }}>
      stats<span style={{ color: C.accent }}>.lk</span>
    </span>
  );
}

// Words that rise in one after another, sharpening as they land
export function Words({
  text,
  delay = 0,
  stagger = 4,
  accent = [],
  style,
  slam,
}: {
  text: string;
  delay?: number;
  stagger?: number;
  accent?: string[];
  style?: CSSProperties;
  // Land from big instead of from below
  slam?: boolean;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(" ");
  return (
    <span style={style}>
      {words.map((word, index) => {
        const p = pop(frame, fps, delay + index * stagger, slam ? { damping: 15, stiffness: 200, mass: 0.7 } : { damping: 18, stiffness: 150, mass: 0.7 });
        const transform = slam ? `scale(${interpolate(p, [0, 1], [1.8, 1])})` : `translateY(${(1 - p) * 0.5}em)`;
        return (
          <Fragment key={index}>
            <span
              style={{
                display: "inline-block",
                opacity: fade(p),
                transform,
                filter: `blur(${Math.max(0, 1 - p) * 14}px)`,
                color: accent.includes(word.replace(/[.,!?]/g, "")) ? C.accent : undefined,
              }}
            >
              {word}
            </span>
            {index < words.length - 1 ? " " : null}
          </Fragment>
        );
      })}
    </span>
  );
}

// A rolling counter: each digit spins like an odometer and blurs while fast
export function Odometer({ target, start, end, fontSize }: { target: number; start: number; end: number; fontSize: number }) {
  const frame = useCurrentFrame();
  const at = (f: number) => target * ramp(f, start, end, EASE_OUT);
  const value = at(frame);
  const speed = Math.abs(value - at(frame - 1));
  const digits = String(target).length;
  const line = 1.1;
  const columns: ReactNode[] = [];
  for (let k = digits - 1; k >= 0; k--) {
    const unit = 10 ** k;
    // Higher digits only turn while the ones below them roll over
    const lower = value % unit;
    const position = k === 0 ? value % 10 : (Math.floor(value / unit) % 10) + Math.max(0, lower - (unit - 1));
    const blur = Math.min(fontSize * 0.05, (speed / unit) * fontSize * 0.02);
    const opacity = interpolate(value, [unit * 0.5, unit], [0.16, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    columns.push(
      <span
        key={`d${k}`}
        style={{
          display: "inline-block",
          width: "0.62em",
          height: `${line}em`,
          overflow: "hidden",
          opacity,
          // Soft top and bottom, so a blurred spinning digit has no hard edge
          maskImage: "linear-gradient(transparent, black 14%, black 86%, transparent)",
          WebkitMaskImage: "linear-gradient(transparent, black 14%, black 86%, transparent)",
        }}
      >
        <span style={{ display: "block", transform: `translateY(${-position * line}em)`, filter: `blur(${blur}px)` }}>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((digit, index) => (
            <span key={index} style={{ display: "block", height: `${line}em`, lineHeight: `${line}em`, textAlign: "center" }}>
              {digit}
            </span>
          ))}
        </span>
      </span>,
    );
    if (k > 0 && k % 3 === 0) {
      columns.push(
        <span key={`c${k}`} style={{ display: "inline-block", width: "0.26em", lineHeight: `${line}em`, opacity }}>
          ,
        </span>,
      );
    }
  }
  return (
    <span style={{ display: "inline-flex", fontSize, fontWeight: 600, letterSpacing: "-0.04em", fontVariantNumeric: "tabular-nums" }}>
      {columns}
    </span>
  );
}

// A trophy medal, drawn like TrophyBadge in the app
function hexagonPath(radius: number, corner: number): string {
  const points = Array.from({ length: 6 }, (_, index) => {
    const angle = (Math.PI / 3) * index - Math.PI / 2;
    return [24 + radius * Math.cos(angle), 24 + radius * Math.sin(angle)];
  });
  const toward = (from: number[], to: number[]) => {
    const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
    return [from[0] + ((to[0] - from[0]) / length) * corner, from[1] + ((to[1] - from[1]) / length) * corner];
  };
  const n = (value: number) => value.toFixed(2);
  const path = points.map((point, index) => {
    const a = toward(point, points[(index + 5) % 6]);
    const b = toward(point, points[(index + 1) % 6]);
    return `${index ? "L" : "M"}${n(a[0])} ${n(a[1])}Q${n(point[0])} ${n(point[1])} ${n(b[0])} ${n(b[1])}`;
  });
  return `${path.join("")}Z`;
}

// Bronze, silver, gold, as in the app
export const TIER_COLORS = ["#cd8a4b", "#c3cad6", "#f2c94c"];
export const TIER_NAMES = ["Bronze", "Silver", "Gold"];

const BADGE_OUTER = hexagonPath(23, 5);
const BADGE_INNER = hexagonPath(17, 4);
const BADGE_COLORS = [
  { rim: C.surface2, plate: C.surface3, face: C.surface2, icon: C.subtle },
  { rim: "#6e3c19", plate: "#d38d55", face: "#9a5a2c", icon: "#ffe3c6" },
  { rim: "#5f6878", plate: "#dde3eb", face: "#8a94a5", icon: "#ffffff" },
  { rim: "#8a5f05", plate: "#f5cd4d", face: "#b5820f", icon: "#fff4c4" },
];

const TROPHY_ICONS: Record<TrophyIcon, LucideIcon> = {
  moon: Moon,
  sunrise: Sunrise,
  calendar: CalendarDays,
  timer: Timer,
  headphones: Headphones,
  flame: Flame,
  compass: Compass,
  shapes: Shapes,
  hourglass: Hourglass,
  sparkles: Sparkles,
  library: Library,
  heart: Heart,
  repeat: Repeat,
  star: Star,
  disc: Disc3,
  layers: Layers,
  users: Users,
  handshake: Handshake,
  crown: Crown,
  history: History,
};

export function TrophyBadge({ icon, tier, size }: { icon: TrophyIcon; tier: number; size: number }) {
  const Icon = TROPHY_ICONS[icon];
  const colors = BADGE_COLORS[tier];
  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", width: size, height: size }}>
      <svg viewBox="0 0 48 48" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.4))" }}>
        <path d={BADGE_OUTER} fill={colors.rim} />
        <path d={BADGE_OUTER} transform="translate(24 23) scale(0.94) translate(-24 -24)" fill={colors.plate} />
        <path d={BADGE_INNER} fill={colors.face} />
        {tier > 0 && <path d={BADGE_INNER} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.8" />}
      </svg>
      <Icon style={{ position: "relative", width: size * 0.38, height: size * 0.38, color: colors.icon }} strokeWidth={2.2} />
    </span>
  );
}

// Slowly drifting green light, a dot grid and rising specks behind every scene.
// From the logo hit to the end card the light pulses on each beat.
export function Background() {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const t = frame / T.fps;
  const beatOn = frame >= T.cuts.logo && frame < T.cuts.end;
  const pulse = beatOn ? Math.exp(-((frame - T.cuts.logo) % T.beat) / 9) : 0;
  const size = Math.max(width, height) * 1.05;
  const glow = (x: number, y: number, color: string) => (
    <div
      style={{
        position: "absolute",
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${color} 0%, rgba(0,0,0,0) 60%)`,
      }}
    />
  );
  return (
    <AbsoluteFill style={{ background: C.background, overflow: "hidden" }}>
      {glow(width * (0.28 + 0.12 * Math.sin(t * 0.35)), height * (0.32 + 0.1 * Math.cos(t * 0.27)), `rgba(34,197,94,${0.15 + 0.07 * pulse})`)}
      {glow(width * (0.75 + 0.1 * Math.cos(t * 0.3)), height * (0.72 + 0.1 * Math.sin(t * 0.22)), `rgba(20,184,166,${0.09 + 0.04 * pulse})`)}
      <AbsoluteFill
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.075) 1.5px, transparent 1.7px)",
          backgroundSize: "48px 48px",
          backgroundPosition: `0px ${(frame * 0.35) % 48}px`,
          maskImage: "radial-gradient(ellipse at center, black 15%, transparent 72%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 15%, transparent 72%)",
        }}
      />
      {Array.from({ length: 36 }, (_, index) => {
        const speed = 0.25 + random(`s${index}`) * 0.9;
        const span = height + 80;
        const y = span - ((frame * speed + random(`o${index}`) * span) % span) - 40;
        const x = random(`x${index}`) * width + Math.sin(frame / 90 + index) * 14;
        const dot = 2 + random(`r${index}`) * 4;
        return (
          <div
            key={index}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: dot,
              height: dot,
              borderRadius: "50%",
              background: C.accent,
              opacity: 0.08 + random(`a${index}`) * 0.3,
            }}
          />
        );
      })}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,0.6) 100%)" }} />
    </AbsoluteFill>
  );
}

// Headline on one side, an app panel tilting in on the other.
// On a vertical video the text sits above the panel.
export function FeatureLayout({
  index,
  icon: Icon,
  label,
  title,
  accent,
  body,
  flip,
  children,
}: {
  index: number;
  icon: LucideIcon;
  label: string;
  title: string;
  accent?: string[];
  body: string;
  flip?: boolean;
  children: ReactNode;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const vertical = useVertical();
  const kicker = pop(frame, fps, 2);
  const bodyIn = ramp(frame, 26, 52);
  const enter = pop(frame, fps, 0, { damping: 22, stiffness: 70, mass: 1 });
  const drift = ramp(frame, 0, 200, Easing.linear);
  const side = flip ? -1 : 1;

  const tilt = vertical
    ? `perspective(2200px) translateY(${(1 - enter) * 260}px) scale(1.12) rotateX(${interpolate(enter, [0, 1], [38, 10]) - drift * 7}deg) rotateY(${(drift - 0.5) * 8}deg)`
    : `perspective(2200px) translateX(${(1 - enter) * side * 300}px) rotateY(${side * (interpolate(enter, [0, 1], [42, 15]) - drift * 9)}deg) rotateX(${4 - drift * 3}deg)`;

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: vertical ? "column" : flip ? "row-reverse" : "row",
        alignItems: "center",
        justifyContent: "center",
        gap: vertical ? 80 : 110,
        padding: vertical ? "0 80px" : "0 140px",
      }}
    >
      <div style={{ width: vertical ? "100%" : 660, flexShrink: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            marginBottom: 28,
            opacity: fade(kicker),
            transform: `translateY(${(1 - kicker) * 20}px)`,
          }}
        >
          <span
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "rgba(34,197,94,0.15)",
              color: C.accent,
              transform: `scale(${kicker})`,
            }}
          >
            <Icon style={{ width: 30, height: 30 }} />
          </span>
          <span style={{ fontSize: 28, fontWeight: 500, color: C.accent }}>{label}</span>
          <span style={{ fontSize: 24, color: C.subtle, fontVariantNumeric: "tabular-nums" }}>0{index}</span>
        </div>
        <div style={{ fontSize: vertical ? 80 : 84, fontWeight: 600, lineHeight: 1.04, letterSpacing: "-0.035em" }}>
          <Words text={title} delay={7} stagger={3} accent={accent} />
        </div>
        <p
          style={{
            margin: "28px 0 0",
            fontSize: 32,
            lineHeight: 1.4,
            color: C.muted,
            opacity: bodyIn,
            transform: `translateY(${(1 - bodyIn) * 24}px)`,
          }}
        >
          {body}
        </p>
      </div>
      <div style={{ flex: vertical ? undefined : 1, display: "flex", justifyContent: "center", opacity: fade(enter), transform: tilt }}>
        {children}
      </div>
    </AbsoluteFill>
  );
}
