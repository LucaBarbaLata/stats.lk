import assert from "node:assert/strict";
import { after, beforeEach, describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { fetchMissingTrackDetails } from "@/lib/catalog";
import { db } from "@/lib/db";
import { albums, artists, streams, trackArtists, tracks } from "@/lib/db/schema";
import { parseHistory } from "@/lib/import/parse";
import { getImportProgress } from "@/lib/import/progress";
import { saveImportedStreams, validateRows } from "@/lib/import/save";
import { addTrack, closeDatabase, createUser, resetDatabase, spotifyId, spotifyTrack, stubFetch } from "./helpers";

const KNOWN = spotifyId("known");
const OTHER = spotifyId("other");
const NEW = spotifyId("new");
const GONE = spotifyId("gone");

const entry = (ts: string, id: string | null, ms: number, extra = {}) => ({
  ts,
  ms_played: ms,
  spotify_track_uri: id && `spotify:track:${id}`,
  master_metadata_track_name: "Some track",
  master_metadata_album_artist_name: "Some artist",
  master_metadata_album_album_name: "Some album",
  ip_addr: "1.2.3.4",
  ...extra,
});

describe("parsing an export", () => {
  it("keeps music plays and skips the rest", () => {
    const parsed = parseHistory([
      entry("2020-05-01T08:00:00Z", KNOWN, 180_000),
      entry("2020-05-01T11:00:00Z", KNOWN, 10_000), // under 30 seconds
      entry("2020-05-01T12:00:00Z", null, 300_000, { spotify_episode_uri: "spotify:episode:x" }), // a podcast
    ]);
    assert.equal(parsed.kind, "extended");
    assert.equal(parsed.rows.length, 1);
    assert.equal(parsed.skipped, 2);
  });

  it("never keeps the IP address", () => {
    const parsed = parseHistory([entry("2020-05-01T08:00:00Z", KNOWN, 180_000)]);
    assert.ok(!JSON.stringify(parsed.rows).includes("1.2.3.4"));
  });

  it("recognises the account data export", () => {
    const parsed = parseHistory([{ endTime: "2024-01-01 10:00", artistName: "a", trackName: "b", msPlayed: 1 }]);
    assert.equal(parsed.kind, "account");
  });

  it("skips plays from before Spotify and impossibly long ones", () => {
    const parsed = parseHistory([
      entry("2005-01-01T00:00:00Z", KNOWN, 200_000),
      entry("2020-06-01T00:00:00Z", KNOWN, 5 * 60 * 60 * 1000),
    ]);
    assert.equal(parsed.rows.length, 0);
    assert.equal(parsed.skipped, 2);
  });
});

describe("checking uploaded rows", () => {
  const good = parseHistory([entry("2020-05-01T08:00:00Z", KNOWN, 180_000)]).rows[0];

  it("accepts a normal play", () => {
    assert.equal(validateRows([good]).length, 1);
  });

  it("rejects plays from before Spotify", () => {
    assert.throws(() => validateRows([{ ...good, playedAt: "2005-01-01T00:00:00.000Z" }]));
  });

  it("rejects bad track ids", () => {
    assert.throws(() => validateRows([{ ...good, trackId: "x' or 1=1" }]));
  });
});

after(closeDatabase);

describe("saving imported plays", () => {
  beforeEach(resetDatabase);

  const rows = (...entries: ReturnType<typeof entry>[]) => validateRows(parseHistory(entries).rows);

  it("merges with plays the API saved and ignores duplicates", async () => {
    const user = await createUser();
    await addTrack(KNOWN, spotifyId("art1"), "Artist one");
    await addTrack(OTHER, spotifyId("art2"), "Artist two");
    await db.insert(streams).values({
      userId: user.id,
      trackId: KNOWN,
      playedAt: new Date("2026-10-01T12:00:00Z"),
      msPlayed: 999,
      source: "api",
    });

    const file = rows(
      entry("2026-10-01T12:00:03Z", KNOWN, 200_000), // the play the API saw
      entry("2020-05-01T08:00:00Z", OTHER, 180_000),
      entry("2020-05-01T08:00:00Z", OTHER, 180_000), // an exact duplicate
    );
    const first = await saveImportedStreams(user.id, file);
    assert.equal(first.added, 1);
    assert.equal(first.merged, 1);

    const second = await saveImportedStreams(user.id, file);
    assert.equal(second.added, 0);

    const saved = await db.select().from(streams).where(eq(streams.userId, user.id));
    assert.equal(saved.length, 2);
    assert.equal(saved.find((play) => play.source === "api")?.msPlayed, 200_000, "the API play gets the exact length");
  });

  it("keeps unknown tracks by name until Spotify is asked", async () => {
    const user = await createUser();
    await saveImportedStreams(user.id, rows(entry("2020-05-01T09:00:00Z", NEW, 210_000, { master_metadata_track_name: null })));
    const [track] = await db.select().from(tracks).where(eq(tracks.id, NEW));
    assert.equal(track.name, "Unknown track");
    assert.equal(track.detailsFetchedAt, null);
  });

  it("fills tracks in from Spotify and stops asking about ones it doesn't know", async () => {
    const user = await createUser();
    await saveImportedStreams(
      user.id,
      rows(entry("2020-05-01T09:00:00Z", NEW, 210_000), entry("2020-05-01T10:00:00Z", GONE, 60_000)),
    );

    const fetchStub = stubFetch((url) => {
      if (url.endsWith(`/tracks/${NEW}`)) {
        return Response.json(spotifyTrack(NEW, { id: spotifyId("real"), name: "Real artist" }, { id: spotifyId("alb"), name: "Real album" }));
      }
      if (url.endsWith(`/tracks/${GONE}`)) return Response.json({ error: { message: "Not found" } }, { status: 404 });
    });
    assert.equal(await fetchMissingTrackDetails(10), 2);
    fetchStub.mock.restore();

    const links = await db.select().from(trackArtists).where(eq(trackArtists.trackId, NEW));
    assert.deepEqual(links.map((link) => link.artistId), [spotifyId("real")]);
    const [gone] = await db.select().from(tracks).where(eq(tracks.id, GONE));
    assert.ok(gone.detailsFetchedAt, "an unknown track isn't retried");
    assert.equal(await fetchMissingTrackDetails(10), 0);
  });
});

describe("import progress", () => {
  beforeEach(resetDatabase);

  it("counts what is left and finishes at 100", async () => {
    const user = await createUser();
    await saveImportedStreams(user.id, [
      { playedAt: "2020-05-01T08:00:00.000Z", trackId: NEW, msPlayed: 180_000, trackName: "Song", artistName: "Band", albumName: "Record" },
    ]);

    const before = await getImportProgress(user.id);
    assert.equal(before.plays, 1);
    assert.deepEqual(before.pictures, { done: 0, total: 2 });
    assert.equal(before.percent, 0);
    assert.equal(before.done, false);

    await db.update(artists).set({ pictureLookedUpAt: new Date(), genresFetchedAt: new Date() });
    await db.update(albums).set({ pictureLookedUpAt: new Date() });
    const finished = await getImportProgress(user.id);
    assert.equal(finished.percent, 100);
    assert.equal(finished.done, true);
  });
});
