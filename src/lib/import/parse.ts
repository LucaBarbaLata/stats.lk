// Parses Spotify's "Extended streaming history" export. Runs in the browser,
// so only the fields below ever leave the user's device (the export also
// holds IP addresses, user agents, country and so on).

export interface ImportRow {
  // When playback ended, ISO 8601 UTC
  playedAt: string;
  trackId: string;
  msPlayed: number;
  trackName: string | null;
  artistName: string | null;
  albumName: string | null;
}

export type HistoryKind = "extended" | "account" | "unknown";

// Rows sent to the server per request (keeps each request well under 1 MB)
export const IMPORT_CHUNK_SIZE = 1000;

// Spotify counts a play as a stream after 30 seconds; shorter plays are skips.
export const MIN_MS_PLAYED = 30_000;
// The server rejects plays outside these bounds (see save.ts), so skip them here
export const EARLIEST_PLAY = Date.UTC(2008, 9, 1);
export const MAX_PLAY_MS = 4 * 60 * 60 * 1000;

// Files in the export ZIP that hold music plays (video and podcast files are skipped)
export const EXTENDED_FILE_PATTERN = /Streaming_History_Audio_[^/]*\.json$/i;
// The basic "Account data" export: last year only, and no track IDs
export const ACCOUNT_FILE_PATTERN = /StreamingHistory_?music_\d+\.json$/i;

const TRACK_URI_PREFIX = "spotify:track:";

const stringOrNull = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.slice(0, 500) : null;

export function parseHistory(data: unknown): {
  kind: HistoryKind;
  rows: ImportRow[];
  skipped: number;
} {
  if (!Array.isArray(data) || data.length === 0) return { kind: "unknown", rows: [], skipped: 0 };
  const first = data[0] as Record<string, unknown>;
  if ("endTime" in first && "trackName" in first) return { kind: "account", rows: [], skipped: 0 };
  if (!("ts" in first)) return { kind: "unknown", rows: [], skipped: 0 };

  const rows: ImportRow[] = [];
  let skipped = 0;
  for (const entry of data as Record<string, unknown>[]) {
    const uri = entry.spotify_track_uri;
    const msPlayed = entry.ms_played;
    const playedAt = typeof entry.ts === "string" ? new Date(entry.ts) : null;
    if (
      typeof uri !== "string" ||
      !uri.startsWith(TRACK_URI_PREFIX) ||
      typeof msPlayed !== "number" ||
      msPlayed < MIN_MS_PLAYED ||
      msPlayed > MAX_PLAY_MS ||
      !playedAt ||
      Number.isNaN(playedAt.getTime()) ||
      playedAt.getTime() < EARLIEST_PLAY
    ) {
      skipped++;
      continue;
    }
    rows.push({
      playedAt: playedAt.toISOString(),
      trackId: uri.slice(TRACK_URI_PREFIX.length),
      msPlayed: Math.round(msPlayed),
      trackName: stringOrNull(entry.master_metadata_track_name),
      artistName: stringOrNull(entry.master_metadata_album_artist_name),
      albumName: stringOrNull(entry.master_metadata_album_album_name),
    });
  }
  return { kind: "extended", rows, skipped };
}
