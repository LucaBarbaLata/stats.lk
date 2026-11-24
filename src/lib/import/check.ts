import { sql } from "drizzle-orm";
import { db } from "../db";
import { importChecks } from "../db/schema";
import type { ImportRow } from "./parse";

// Looks for exports that were edited. Spotify doesn't sign them, so this can't
// prove one is real: it only catches what can't be true. Everything is compared
// with our own catalog. Tracks we don't know yet are looked up on Spotify by the
// worker (fetchMissingTrackDetails), and the next check includes them.

// A play can be a little longer than its track, when someone seeks back
const isTooLong = (msPlayed: number, durationMs: number) => msPlayed > durationMs * 1.1 + 30_000;
// Same rule, for queries
const tooLongSql = sql`p.ms_played > p.duration_ms * 1.1 + 30000`;

// How many plays of a chunk have to be about tracks we know before it can be
// refused, and how many of those have to be wrong. Real exports are nowhere
// near half.
const MIN_KNOWN_ROWS = 20;
const REFUSE_ABOVE = 0.5;

export class ImportRefusedError extends Error {
  constructor() {
    super("Many plays in this file don't match Spotify's catalog, so the rest of it wasn't imported");
    this.name = "ImportRefusedError";
  }
}

const plain = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

// Throws when a chunk is mostly wrong about tracks Spotify has told us about:
// another artist, or plays longer than the track.
export async function refuseIfEdited(rows: ImportRow[]): Promise<void> {
  if (!rows.length) return;
  const ids = JSON.stringify([...new Set(rows.map((row) => row.trackId))]);
  // Exports name the album's artist, so those count as right too
  const known = await db.execute<{ id: string; durationMs: number; names: string[] | null }>(sql`
    select t.id, t.duration_ms as "durationMs",
      (select json_agg(distinct a.name) from artists a where a.id in (
        select ta.artist_id from track_artists ta where ta.track_id = t.id
        union select aa.artist_id from album_artists aa where aa.album_id = t.album_id)) as names
    from tracks t
    where t.details_fetched_at is not null and t.duration_ms is not null
      and t.id in (select jsonb_array_elements_text(${ids}::jsonb))`);
  const tracks = new Map(known.map((track) => [track.id, { ...track, names: new Set((track.names ?? []).map(plain)) }]));

  let checked = 0;
  let wrong = 0;
  for (const row of rows) {
    const track = tracks.get(row.trackId);
    if (!track) continue;
    checked++;
    const otherArtist = row.artistName !== null && track.names.size > 0 && !track.names.has(plain(row.artistName));
    if (otherArtist || isTooLong(row.msPlayed, track.durationMs)) wrong++;
  }
  if (checked >= MIN_KNOWN_ROWS && wrong / checked > REFUSE_ABOVE) throw new ImportRefusedError();
}

export interface ImportCheck {
  plays: number;
  // Plays of tracks whose length Spotify has told us
  checked: number;
  tooLong: number;
  // Plays of tracks Spotify doesn't know
  unknown: number;
  // Plays that started well before the previous one ended
  overlapping: number;
  // Days with more than 24 hours of music
  impossibleDays: number;
}

// Generous, because real exports have some of each: tracks Spotify removed,
// listening offline on two devices, offline plays all dated when they were sent
const MIN_PLAYS = 50;

export function isUnusual(check: ImportCheck): boolean {
  const looked = check.checked + check.unknown;
  return (
    (check.checked >= MIN_PLAYS && check.tooLong / check.checked > 0.05) ||
    (looked >= MIN_PLAYS && check.unknown / looked > 0.3) ||
    (check.plays >= MIN_PLAYS && check.overlapping / check.plays > 0.25) ||
    check.impossibleDays >= 5
  );
}

// Checks everything someone imported and stores the result. Returns null when
// they imported nothing.
export async function checkImport(userId: string): Promise<(ImportCheck & { unusual: boolean }) | null> {
  const [row] = await db.execute<ImportCheck & Record<string, unknown>>(sql`
    with p as (
      select s.played_at, s.ms_played, t.duration_ms, t.details_fetched_at is not null as looked_up,
        lag(s.played_at) over (order by s.played_at, s.id) as previous_end
      from streams s join tracks t on t.id = s.track_id
      where s.user_id = ${userId}::uuid and s.source = 'import'
    )
    select count(*)::int as plays,
      count(*) filter (where p.looked_up and p.duration_ms is not null)::int as checked,
      count(*) filter (where p.looked_up and ${tooLongSql})::int as "tooLong",
      count(*) filter (where p.looked_up and p.duration_ms is null)::int as unknown,
      count(*) filter (where p.played_at - make_interval(secs => p.ms_played / 1000.0) < p.previous_end - interval '30 seconds')::int as overlapping,
      (select count(*)::int from (
        select 1 from p group by (p.played_at at time zone 'UTC')::date having sum(p.ms_played) > 86400000) d) as "impossibleDays"
    from p`);
  if (!row?.plays) {
    await db.execute(sql`delete from import_checks where user_id = ${userId}::uuid`);
    return null;
  }

  const check: ImportCheck = {
    plays: row.plays,
    checked: row.checked,
    tooLong: row.tooLong,
    unknown: row.unknown,
    overlapping: row.overlapping,
    impossibleDays: row.impossibleDays,
  };
  const values = { ...check, unusual: isUnusual(check), checkedAt: new Date() };
  await db
    .insert(importChecks)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: importChecks.userId, set: values });
  return { ...check, unusual: values.unusual };
}

// Run by the worker: people whose imports weren't checked for a day, or never
export async function checkDueImports(limit: number): Promise<number> {
  const due = await db.execute<{ id: string }>(sql`
    select u.id from users u
    left join import_checks c on c.user_id = u.id
    where (c.checked_at is null or c.checked_at < now() - interval '1 day')
      and exists (select 1 from streams s where s.user_id = u.id and s.source = 'import')
    order by c.checked_at asc nulls first
    limit ${limit}`);
  for (const { id } of due) await checkImport(id);
  return due.length;
}

// The stored result, for the import page
export async function getImportCheck(userId: string) {
  const [row] = await db.execute<{ unusual: boolean }>(sql`
    select unusual from import_checks where user_id = ${userId}::uuid`);
  return row ?? null;
}
