// Last.fm is only used for artist genres: Spotify stopped returning them.
// Last.fm tags are user-made ("seen live", "canadian", ...), so only tags
// that look like a music genre are kept.

const API_URL = "https://ws.audioscrobbler.com/2.0/";
// Last.fm weighs tags 0-100, relative to the artist's top tag
const MIN_TAG_WEIGHT = 10;
const MAX_GENRES = 5;

export class LastfmError extends Error {
  constructor(
    message: string,
    // Last.fm error code, e.g. 10 = invalid API key, 29 = rate limit
    readonly code?: number,
  ) {
    super(message);
    this.name = "LastfmError";
  }
}

// Matched anywhere in the tag ("synthpop", "deep house", "romanian hip hop")
const GENRE_PARTS = [
  "pop", "rock", "metal", "punk", "jazz", "blues", "soul", "funk", "disco", "house",
  "techno", "trance", "electro", "dance", "dubstep", "hip hop", "r&b", "trap", "drill",
  "grime", "phonk", "folk", "country", "bluegrass", "americana", "reggae", "indie",
  "alternative", "ambient", "classical", "orchestral", "opera", "soundtrack", "synth",
  "wave", "grunge", "shoegaze", "garage", "drum and bass", "jungle", "breakbeat",
  "hardcore", "hardstyle", "downtempo", "chillout", "lo-fi", "lofi", "psychedelic",
  "progressive", "experimental", "industrial", "gospel", "worship", "singer-songwriter",
  "acoustic", "latin", "salsa", "bachata", "cumbia", "tango", "samba", "bossa nova",
  "sertanejo", "afro", "amapiano", "manele", "schlager", "chanson", "flamenco", "fado",
  "swing", "polka", "new age",
];
// Matched as whole words only, since they are short ("emo" is not "demo")
const GENRE_WORDS = ["rap", "emo", "ska", "dub", "edm", "idm", "mpb", "noise", "musical"];

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const GENRE_PATTERN = new RegExp(
  [...GENRE_PARTS.map(escape), ...GENRE_WORDS.map((word) => `\\b${escape(word)}\\b`)].join("|"),
);
const BLOCKED_PATTERN = /seen live|favou?rite|\bbest\b|\bmy\b|albums i own|popular|\blove\b|under \d/;

export function normalizeGenre(tag: string): string | null {
  const name = tag
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/hip-hop|hiphop/g, "hip hop")
    .replace(/\b(rnb|r'n'b|r 'n' b|rn'b)\b/g, "r&b")
    .replace(/drum (n|&|'n'|n') bass|\bdnb\b/g, "drum and bass");
  if (!name || name.length > 40 || BLOCKED_PATTERN.test(name)) return null;
  return GENRE_PATTERN.test(name) ? name : null;
}

// Tags must come sorted by weight, highest first (as Last.fm returns them).
export function pickGenres(tags: { name: string; weight: number }[]): string[] {
  const genres: string[] = [];
  for (const tag of tags) {
    if (tag.weight < MIN_TAG_WEIGHT) continue;
    const genre = normalizeGenre(tag.name);
    if (genre && !genres.includes(genre)) genres.push(genre);
    if (genres.length === MAX_GENRES) break;
  }
  return genres;
}

// Returns null when Last.fm doesn't know the artist.
export async function getArtistGenres(artistName: string, apiKey: string): Promise<string[] | null> {
  const params = new URLSearchParams({
    method: "artist.gettoptags",
    artist: artistName,
    autocorrect: "1",
    api_key: apiKey,
    format: "json",
  });
  const res = await fetch(`${API_URL}?${params}`, { headers: { "User-Agent": "stats.lk" } });
  const body = await res.json().catch(() => null);
  if (body?.error === 6) return null;
  if (!res.ok || body?.error) {
    throw new LastfmError(`Last.fm: ${body?.message ?? `HTTP ${res.status}`}`, body?.error);
  }
  // Last.fm's JSON turns one-element lists into a plain object
  const raw = body?.toptags?.tag ?? [];
  const tags: { name: string; count: number | string }[] = Array.isArray(raw) ? raw : [raw];
  return pickGenres(tags.map((tag) => ({ name: String(tag.name), weight: Number(tag.count) })));
}
