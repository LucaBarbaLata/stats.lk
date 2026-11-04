import { sql } from "drizzle-orm";
import { db } from "../db";
import { tracks } from "../db/schema";
import { linkImportedTracks } from "./link";
import { EARLIEST_PLAY, IMPORT_CHUNK_SIZE, MAX_PLAY_MS, type ImportRow } from "./parse";

const TRACK_ID = /^[0-9A-Za-z]{22}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

// Limits that keep a hand-made "export" from flooding the database. The
// export can't be verified (Spotify doesn't sign it), so these only bound
// what one account can add, and only to its own stats.
// Spotify launched in October 2008 (EARLIEST_PLAY); no single play is longer
// than MAX_PLAY_MS. Both live in parse.ts so the browser skips such rows too.
export const MAX_IMPORTED_PLAYS = 1_000_000;

const isNameOrNull = (value: unknown) =>
  value === null || (typeof value === "string" && value.length <= 500);

export class ImportLimitError extends Error {
  constructor() {
    super(`An account can import at most ${MAX_IMPORTED_PLAYS.toLocaleString("en-US")} plays`);
    this.name = "ImportLimitError";
  }
}

// The rows come from the browser, so check every field before trusting it.
export function validateRows(input: unknown): ImportRow[] {
  if (!Array.isArray(input) || input.length > IMPORT_CHUNK_SIZE) {
    throw new Error("Invalid import chunk");
  }
  return input.map((row) => {
    const playedAt = new Date(row?.playedAt);
    if (
      typeof row?.playedAt !== "string" ||
      Number.isNaN(playedAt.getTime()) ||
      playedAt.getTime() > Date.now() + DAY_MS ||
      playedAt.getTime() < EARLIEST_PLAY ||
      typeof row.trackId !== "string" ||
      !TRACK_ID.test(row.trackId) ||
      !Number.isInteger(row.msPlayed) ||
      row.msPlayed < 0 ||
      row.msPlayed > MAX_PLAY_MS ||
      !isNameOrNull(row.trackName) ||
      !isNameOrNull(row.artistName) ||
      !isNameOrNull(row.albumName)
    ) {
      throw new Error("Invalid import row");
    }
    return {
      playedAt: playedAt.toISOString(),
      trackId: row.trackId,
      msPlayed: row.msPlayed,
      trackName: row.trackName,
      artistName: row.artistName,
      albumName: row.albumName,
    };
  });
}

// Saves imported plays. A play the worker already saved from the API is not
// duplicated; it gets the exact ms_played from the export instead. The API
// play counts as the same one when it ended between the imported play's
// start and end (with 10s of slack). Importing the same file twice adds nothing.
export async function saveImportedStreams(
  userId: string,
  rows: ImportRow[],
): Promise<{ added: number; merged: number }> {
  if (!rows.length) return { added: 0, merged: 0 };

  const placeholders = [...new Map(rows.map((row) => [row.trackId, row])).values()].map(
    (row) => ({
      id: row.trackId,
      name: row.trackName ?? "Unknown track",
      importedArtistName: row.artistName,
      importedAlbumName: row.albumName,
    }),
  );
  const incoming = JSON.stringify(
    rows.map((row) => ({
      track_id: row.trackId,
      played_at: row.playedAt,
      ms_played: row.msPlayed,
    })),
  );
  const incomingRows = sql`jsonb_to_recordset(${incoming}::jsonb)
    as i(track_id text, played_at timestamptz, ms_played int)`;
  const sameApiPlay = sql`s.user_id = ${userId}::uuid and s.source = 'api' and s.track_id = i.track_id
    and s.played_at between i.played_at - make_interval(secs => i.ms_played / 1000.0) - interval '10 seconds'
                        and i.played_at + interval '10 seconds'`;

  return db.transaction(async (tx) => {
    const [{ imported }] = await tx.execute<{ imported: number }>(sql`
      select count(*)::int as imported from streams where user_id = ${userId}::uuid and source = 'import'`);
    if (imported + rows.length > MAX_IMPORTED_PLAYS) throw new ImportLimitError();

    // Tracks the database hasn't seen yet, linked by name so they count for
    // artists and albums at once; the worker looks them up on Spotify later
    await tx.insert(tracks).values(placeholders).onConflictDoNothing();
    await linkImportedTracks(tx, placeholders.map((track) => track.id));

    const [{ merged }] = await tx.execute<{ merged: number }>(sql`
      with updated as (
        update streams s set ms_played = i.ms_played
        from ${incomingRows}
        where ${sameApiPlay}
        returning 1
      )
      select count(*)::int as merged from updated`);

    const [{ added }] = await tx.execute<{ added: number }>(sql`
      with inserted as (
        insert into streams (user_id, track_id, played_at, ms_played, source)
        select ${userId}::uuid, i.track_id, i.played_at, i.ms_played, 'import'::stream_source
        from ${incomingRows}
        where not exists (select 1 from streams s where ${sameApiPlay})
        on conflict do nothing
        returning 1
      )
      select count(*)::int as added from inserted`);

    return { added, merged };
  });
}
