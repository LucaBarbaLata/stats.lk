// Colours for the share cards. Any theme works with any layout.

export interface Theme {
  label: string;
  background: string;
  gradient?: string;
  text: string;
  muted: string;
  accent: string;
  // Behind a missing picture
  tile: string;
  // Tiles, podium steps and the logo's pill over a photo
  surface: string;
  // The logo's square and its bars
  mark: [string, string];
  // Around text drawn over a photo
  glow: string;
  // On every picture
  imageFilter?: string;
  // The top picture, blurred, fills the background
  backdrop?: boolean;
  // For the theme picker on the share page
  swatch: string;
}

const CLASSIC_GLOW = "linear-gradient(180deg, #0f3d22 0%, #0c0c11 55%)";

export const THEME_KEYS = ["classic", "midnight", "sunset", "light", "vivid", "mono", "blur"] as const;

export type ThemeKey = (typeof THEME_KEYS)[number];

export const THEMES: Record<ThemeKey, Theme> = {
  classic: {
    label: "Classic",
    background: "#0c0c11",
    gradient: CLASSIC_GLOW,
    text: "#f3f3f6",
    muted: "#a1a1b3",
    accent: "#4ade80",
    tile: "#1e1e28",
    surface: "rgba(255,255,255,0.07)",
    mark: ["#22c55e", "#04210f"],
    glow: "rgba(0,0,0,0.5)",
    swatch: "linear-gradient(135deg, #14532d, #0c0c11)",
  },
  midnight: {
    label: "Midnight",
    background: "#0a0e27",
    gradient: "linear-gradient(170deg, #3730a3 0%, #151a4a 30%, #0a0e27 60%)",
    text: "#eef0ff",
    muted: "#9ea6d8",
    accent: "#a5b4fc",
    tile: "#1c2252",
    surface: "rgba(165,180,252,0.11)",
    mark: ["#a5b4fc", "#151a4a"],
    glow: "rgba(0,0,0,0.5)",
    swatch: "linear-gradient(135deg, #3730a3, #0a0e27)",
  },
  sunset: {
    label: "Sunset",
    background: "#e8508a",
    gradient: "linear-gradient(170deg, #ffb35c 0%, #ff6b81 40%, #b13ce0 80%, #7c2fd6 100%)",
    text: "#ffffff",
    muted: "rgba(255,255,255,0.8)",
    accent: "#fff1a8",
    tile: "rgba(255,255,255,0.22)",
    surface: "rgba(255,255,255,0.16)",
    mark: ["#ffffff", "#e8508a"],
    glow: "rgba(90,20,80,0.45)",
    swatch: "linear-gradient(135deg, #ffb35c, #ff6b81, #8b3dff)",
  },
  light: {
    label: "Light",
    background: "#f5f2ea",
    gradient: "linear-gradient(180deg, #d5ecd9 0%, #f5f2ea 50%)",
    text: "#111116",
    muted: "#666672",
    accent: "#15803d",
    tile: "#e5e0d4",
    surface: "rgba(17,17,22,0.06)",
    mark: ["#15803d", "#f5f2ea"],
    glow: "rgba(245,242,234,0.85)",
    swatch: "linear-gradient(135deg, #d5ecd9, #f5f2ea)",
  },
  vivid: {
    label: "Vivid",
    background: "#22c55e",
    gradient: "linear-gradient(165deg, #a7f3c4 0%, #4ade80 40%, #22c55e 100%)",
    text: "#04210f",
    muted: "#0f4d29",
    accent: "#04210f",
    tile: "#16a34a",
    surface: "rgba(4,33,15,0.1)",
    mark: ["#04210f", "#4ade80"],
    glow: "rgba(167,243,196,0.8)",
    swatch: "linear-gradient(135deg, #a7f3c4, #22c55e)",
  },
  mono: {
    label: "Mono",
    background: "#000000",
    text: "#ffffff",
    muted: "#8c8c8c",
    accent: "#ffffff",
    tile: "#1a1a1a",
    surface: "rgba(255,255,255,0.08)",
    mark: ["#ffffff", "#000000"],
    glow: "rgba(0,0,0,0.6)",
    imageFilter: "grayscale(1) contrast(1.1)",
    swatch: "linear-gradient(135deg, #ffffff 50%, #000000 50%)",
  },
  blur: {
    label: "Blur",
    background: "#0c0c11",
    // Shows only when there's no picture to blur
    gradient: CLASSIC_GLOW,
    text: "#ffffff",
    muted: "rgba(255,255,255,0.72)",
    accent: "#4ade80",
    tile: "rgba(255,255,255,0.14)",
    surface: "rgba(255,255,255,0.1)",
    mark: ["#22c55e", "#04210f"],
    glow: "rgba(0,0,0,0.45)",
    backdrop: true,
    swatch: "linear-gradient(135deg, #7c3aed, #db2777, #f59e0b)",
  },
};
