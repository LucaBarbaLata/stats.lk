import type { NextRequest } from "next/server";
import { client } from "@/lib/db";
import { getHiddenItems } from "@/lib/hidden";
import { getCurrentUser } from "@/lib/session";
import { listPeople } from "@/lib/social";

// Downloads all of the user's plays as CSV (one row per play) or JSON (plays
// plus profile, friends and hidden items). Streamed with a cursor, so large
// histories don't have to fit in memory.

const BATCH = 2000;
const COLUMNS = ["played_at", "track", "artists", "album", "spotify_track_uri", "ms_played", "source"] as const;

type Row = Record<(typeof COLUMNS)[number], string | number>;

const csvField = (value: string | number) =>
  typeof value === "number" ? String(value) : `"${value.replace(/"/g, '""')}"`;

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new Response("Not logged in", { status: 401 });
  const format = request.nextUrl.searchParams.get("format") === "json" ? "json" : "csv";

  const plays = client<Row[]>`
    select to_char(s.played_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as played_at,
      t.name as track,
      coalesce(
        (select string_agg(a.name, ', ' order by ta.position)
         from track_artists ta join artists a on a.id = ta.artist_id where ta.track_id = t.id),
        t.imported_artist_name, '') as artists,
      coalesce(al.name, t.imported_album_name, '') as album,
      'spotify:track:' || t.id as spotify_track_uri,
      s.ms_played,
      s.source::text as source
    from streams s
    join tracks t on t.id = s.track_id
    left join albums al on al.id = t.album_id
    where s.user_id = ${user.id}
    order by s.played_at`.cursor(BATCH)[Symbol.asyncIterator]();

  const encoder = new TextEncoder();
  let first = true;
  let header: string;
  if (format === "csv") {
    // The BOM makes Excel read the file as UTF-8 (diacritics)
    header = `\uFEFF${COLUMNS.join(",")}\n`;
  } else {
    const [friends, hidden] = await Promise.all([listPeople(user.id), getHiddenItems(user.id)]);
    const account = {
      exportedAt: new Date().toISOString(),
      profile: {
        username: user.username,
        spotifyId: user.spotifyId,
        displayName: user.displayName,
        visibility: user.visibility,
        showNowPlaying: user.showNowPlaying,
        joinedAt: user.createdAt.toISOString(),
      },
      friends: friends
        .filter((person) => person.relation !== "none")
        .map((person) => ({ displayName: person.displayName, username: person.username, status: person.relation })),
      hiddenItems: hidden.map((item) => ({ type: item.type, spotifyId: item.itemId, name: item.name })),
    };
    // Open the object and the plays array; rows and the closing brackets follow
    header = `${JSON.stringify(account, null, 2).slice(0, -2)},\n  "plays": [\n`;
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(header));
    },
    async pull(controller) {
      const { value: rows, done } = await plays.next();
      if (done) {
        if (format === "json") controller.enqueue(encoder.encode("\n  ]\n}\n"));
        controller.close();
        return;
      }
      const text =
        format === "csv"
          ? rows.map((row) => COLUMNS.map((column) => csvField(row[column])).join(",")).join("\n") + "\n"
          : rows
              .map((row) => {
                const line = `    ${JSON.stringify(row)}`;
                const prefix = first ? "" : ",\n";
                first = false;
                return prefix + line;
              })
              .join("");
      controller.enqueue(encoder.encode(text));
    },
    async cancel() {
      await plays.return?.();
    },
  });

  const date = new Date().toISOString().slice(0, 10);
  return new Response(stream, {
    headers: {
      "Content-Type": format === "csv" ? "text/csv; charset=utf-8" : "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="stats-lk-export-${date}.${format}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
