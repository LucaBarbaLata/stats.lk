import { loadFont } from "@remotion/google-fonts/Geist";
import { Easing, interpolate, spring, useVideoConfig } from "remotion";

// The site's font and colours (src/app/globals.css in the app)
export const { fontFamily } = loadFont("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

export const C = {
  background: "#0c0c11",
  surface: "#14141b",
  surface2: "#1c1c25",
  surface3: "#272732",
  border: "#22222c",
  borderStrong: "#34343f",
  foreground: "#f3f3f6",
  muted: "#a1a1b3",
  subtle: "#6f6f82",
  accent: "#4ade80",
  accentFill: "#22c55e",
  accentForeground: "#04210f",
};

// Shown on the end card
export const SITE_URL = "stats.lucariki.top";

export const DAYPARTS = [
  { label: "Night", from: 0, color: "#7f73f0" },
  { label: "Morning", from: 6, color: "#c27d0e" },
  { label: "Afternoon", from: 12, color: "#1597d6" },
  { label: "Evening", from: 18, color: "#e05f86" },
];

// The site's easing, cubic-bezier(0.2, 0.7, 0.2, 1)
export const EASE = Easing.bezier(0.2, 0.7, 0.2, 1);
export const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// 0 → 1 between two frames
export function ramp(frame: number, start: number, end: number, easing = EASE) {
  return interpolate(frame, [start, end], [0, 1], { ...clamp, easing });
}

// A springy 0 → 1 that starts at `delay`
export function pop(frame: number, fps: number, delay = 0, config: Partial<{ damping: number; stiffness: number; mass: number }> = {}) {
  return spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 170, mass: 0.6, ...config } });
}

export function fade(value: number) {
  return interpolate(value, [0, 0.6], [0, 1], clamp);
}

export function fmt(value: number) {
  return Math.round(value).toLocaleString("en-US");
}

export function useVertical() {
  const { width, height } = useVideoConfig();
  return height > width;
}
