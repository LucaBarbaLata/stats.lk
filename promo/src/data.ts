import { createContext, useContext } from "react";

// Everything the trailer shows about one listener. `npm run promo:stats` in the
// app writes a real one to public/me/stats.json; without it, SAMPLE plays.
// Pictures are paths inside public/, or null for a colour tile.

export type TrophyIcon =
  | "moon"
  | "sunrise"
  | "calendar"
  | "timer"
  | "headphones"
  | "flame"
  | "compass"
  | "shapes"
  | "hourglass"
  | "sparkles"
  | "library"
  | "heart"
  | "repeat"
  | "star"
  | "disc"
  | "layers"
  | "users"
  | "handshake"
  | "crown"
  | "history";

export type Artist = { name: string; plays: number; minutes: number; image: string | null; hue: number };
export type Track = { name: string; artist: string; plays: number; image: string | null; hue: number };
export type Album = { name: string; artist: string; plays: number; minutes: number; image: string | null; hue: number };
export type Genre = { name: string; plays: number; minutes: number; hue: number };

export type TrailerData = {
  year: number;
  // This year
  minutes: number;
  plays: number;
  artists: number;
  streak: number;
  // The top list cycles through these three, all ranked by plays this year
  topArtists: Artist[];
  topAlbums: Album[];
  topGenres: Genre[];
  topTracks: Track[];
  // Wrapped ranks artists by minutes
  wrappedArtist: Artist;
  topGenre: string | null;
  // Minutes per day for 24 weeks, Monday first, -1 for days still to come
  heat: number[];
  // Minutes by hour of day this year
  hours: number[];
  imported: number;
  firstYear: number;
  // Plays per year, from firstYear to year
  playsByYear: number[];
  level: { level: number; title: string; progress: number; toNext: number | null };
  // Six, mixing tiers; the first one is shown climbing from bronze to its tier
  trophies: { name: string; icon: TrophyIcon; tier: number }[];
  // Friends stay made up: the names are placeholders. Without an avatar, the
  // first friend gets the cat and the second the skier (public/avatars).
  friends: { name: string; hue: number; track: Track; avatar?: string | null }[];
  tasteMatch: number;
};

export type TrailerProps = { data: TrailerData };

const SAMPLE_ARTISTS: Artist[] = [
  { name: "Northern Static", plays: 402, minutes: 1284, hue: 152, image: null },
  { name: "Ilinca Vale", plays: 351, minutes: 1037, hue: 24, image: null },
  { name: "The Paper Moons", plays: 298, minutes: 866, hue: 262, image: null },
  { name: "Coastal Signals", plays: 240, minutes: 702, hue: 198, image: null },
  { name: "Mira and the Tides", plays: 219, minutes: 655, hue: 330, image: null },
];

const SAMPLE_TRACKS: Track[] = [
  { name: "Glass Harbour", artist: "Northern Static", plays: 96, image: null, hue: 152 },
  { name: "Paper Lanterns", artist: "Ilinca Vale", plays: 81, image: null, hue: 24 },
  { name: "Night Swim", artist: "The Paper Moons", plays: 77, image: null, hue: 262 },
  { name: "Low Tide", artist: "Coastal Signals", plays: 64, image: null, hue: 198 },
  { name: "Saltwater", artist: "Mira and the Tides", plays: 59, image: null, hue: 330 },
];

export const SAMPLE: TrailerData = {
  year: 2026,
  minutes: 24310,
  plays: 6947,
  artists: 412,
  streak: 31,
  topArtists: SAMPLE_ARTISTS,
  topAlbums: [
    { name: "Low Light Hours", artist: "Northern Static", plays: 188, minutes: 702, image: null, hue: 152 },
    { name: "Paper Houses", artist: "Ilinca Vale", plays: 164, minutes: 571, image: null, hue: 24 },
    { name: "Moonlit Static", artist: "The Paper Moons", plays: 131, minutes: 455, image: null, hue: 262 },
    { name: "Signal Fires", artist: "Coastal Signals", plays: 117, minutes: 398, image: null, hue: 198 },
    { name: "Undertow", artist: "Mira and the Tides", plays: 96, minutes: 341, image: null, hue: 330 },
  ],
  topGenres: [
    { name: "indie pop", plays: 1240, minutes: 4210, hue: 152 },
    { name: "dream pop", plays: 980, minutes: 3320, hue: 24 },
    { name: "alternative", plays: 845, minutes: 2905, hue: 262 },
    { name: "electronic", plays: 610, minutes: 2088, hue: 198 },
    { name: "folk", plays: 402, minutes: 1377, hue: 330 },
  ],
  topTracks: SAMPLE_TRACKS,
  wrappedArtist: SAMPLE_ARTISTS[0],
  topGenre: "Indie pop",
  heat: Array.from({ length: 24 * 7 }, (_, index) =>
    Math.max(0, Math.sin(index / 9) + Math.sin(index / 3.7) * 0.6 + ((index * 37) % 11) / 8) * 60,
  ),
  hours: [8, 5, 3, 2, 1, 1, 3, 9, 14, 12, 10, 11, 15, 13, 12, 14, 18, 22, 26, 30, 34, 38, 31, 18],
  imported: 48213,
  firstYear: 2016,
  playsByYear: [0.28, 0.35, 0.31, 0.46, 0.62, 0.55, 0.7, 0.66, 0.84, 1, 0.88].map((share) => Math.round(share * 9000)),
  level: { level: 19, title: "Opening act", progress: 0.41, toNext: 1714 },
  trophies: [
    { name: "Night owl", icon: "moon", tier: 3 },
    { name: "Marathon", icon: "timer", tier: 2 },
    { name: "Explorer", icon: "compass", tier: 1 },
    { name: "Loyal fan", icon: "heart", tier: 3 },
    { name: "Time traveller", icon: "hourglass", tier: 2 },
    { name: "Album diver", icon: "disc", tier: 1 },
  ],
  friends: [
    { name: "Maya", hue: 300, track: SAMPLE_TRACKS[0] },
    { name: "Andrei", hue: 40, track: SAMPLE_TRACKS[1] },
  ],
  tasteMatch: 81,
};

const DataContext = createContext<TrailerData>(SAMPLE);
export const DataProvider = DataContext.Provider;

export const FRIEND_AVATARS = ["avatars/cat.svg", "avatars/skier.svg"];

export function useData() {
  return useContext(DataContext);
}
