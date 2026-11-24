import assert from "node:assert/strict";
import { after, beforeEach, describe, it } from "node:test";
import { eq, sql } from "drizzle-orm";
import { fetchMissingTrackDetails } from "@/lib/catalog";
import { db } from "@/lib/db";
import { importChecks, streams, tracks, users } from "@/lib/db/schema";
import { checkDueImports, checkImport, ImportRefusedError, isUnusual, refuseIfEdited } from "@/lib/import/check";
import type { ImportRow } from "@/lib/import/parse";
import { saveImportedStreams } from "@/lib/import/save";
import { addTrack, closeDatabase, createUser, resetDatabase, spotifyId, spotifyTrack, stubFetch } from "./helpers";

const KNOWN = spotifyId("known");
const NEW = spotifyId("new");
const DAY_MS = 86_400_000;
const START = Date.UTC(2024, 0, 1);

// Plays of one track, `everyMs` apart
const plays = (count: number, overrides: Partial<ImportRow> = {}, everyMs = 600_000): ImportRow[] =>
  Array.from({ length: count }, (_, i) => ({
    playedAt: new Date(START + i * everyMs).toISOString(),
    trackId: KNOWN,
    msPlayed: 180_000,
    trackName: "Track",
    artistName: "Band",
    albumName: "Album",
    ...overrides,
  }));

let userId: string;

beforeEach(async () => {
  await resetDatabase();
  userId = (await createUser()).id;
  await addTrack(KNOWN, spotifyId("band"), "Band");
  await db.update(tracks).set({ durationMs: 200_000 });
});

after(closeDatabase);

describe("refusing an edited file", () => {
  it("accepts plays that match our catalog", async () => {
    assert.deepEqual(await saveImportedStreams(userId, plays(100)), { added: 100, merged: 0 });
  });

  it("refuses plays longer than their track, and saves none of them", async () => {
    await assert.rejects(saveImportedStreams(userId, plays(100, { msPlayed: 3_600_000 })), ImportRefusedError);
    assert.equal((await db.select().from(streams)).length, 0);
  });

  it("refuses tracks credited to another artist", async () => {
    await assert.rejects(refuseIfEdited(plays(100, { artistName: "Somebody else" })), ImportRefusedError);
  });

  it("accepts the same artist written differently, and the album's artist", async () => {
    await refuseIfEdited(plays(100, { artistName: "BÄND" }));
    await db.execute(sql`insert into artists (id, name) values ('va', 'Various Artists')`);
    await db.execute(sql`insert into albums (id, name) values ('mix', 'Mix')`);
    await db.execute(sql`insert into album_artists (album_id, artist_id, position) values ('mix', 'va', 0)`);
    await db.update(tracks).set({ albumId: "mix" });
    await refuseIfEdited(plays(100, { artistName: "Various Artists" }));
  });

  it("accepts a few wrong plays among many", async () => {
    await refuseIfEdited([...plays(80), ...plays(20, { msPlayed: 3_600_000 })]);
  });

  it("can't tell about tracks it doesn't know, or too few of them", async () => {
    await refuseIfEdited(plays(100, { trackId: NEW, artistName: "Anyone", msPlayed: 3_600_000 }));
    await refuseIfEdited(plays(19, { msPlayed: 3_600_000 }));
  });

  it("doesn't trust names that came from another import", async () => {
    await saveImportedStreams(userId, plays(30, { trackId: NEW, artistName: "Made up" }));
    await refuseIfEdited(plays(100, { trackId: NEW, artistName: "The real one" }));
  });

  it("asks Spotify nothing", async () => {
    const stub = stubFetch();
    await saveImportedStreams(userId, plays(50, { trackId: NEW }));
    await checkImport(userId);
    assert.equal(stub.mock.callCount(), 0);
    stub.mock.restore();
  });
});

describe("checking what was imported", () => {
  it("finds nothing unusual in a normal import", async () => {
    await saveImportedStreams(userId, plays(100));
    assert.deepEqual(await checkImport(userId), {
      plays: 100, checked: 100, tooLong: 0, unknown: 0, overlapping: 0, impossibleDays: 0, unusual: false,
    });
  });

  it("looks again once Spotify has answered for a track it didn't know", async () => {
    await saveImportedStreams(userId, plays(60, { trackId: NEW, msPlayed: 3_000_000 }, 3_600_000));
    assert.equal((await checkImport(userId))?.unusual, false, "nothing to compare with yet");

    const stub = stubFetch((url) =>
      url.includes("/v1/tracks/")
        ? Response.json({ ...spotifyTrack(NEW, { id: spotifyId("band"), name: "Band" }, { id: spotifyId("album"), name: "Album" }) })
        : undefined,
    );
    await fetchMissingTrackDetails(5);
    stub.mock.restore();

    const check = await checkImport(userId);
    assert.equal(check?.tooLong, 60);
    assert.equal(check?.unusual, true);
  });

  it("counts tracks Spotify doesn't know", async () => {
    await saveImportedStreams(userId, plays(60, { trackId: NEW }));
    const stub = stubFetch((url) => (url.includes("/v1/tracks/") ? Response.json({}, { status: 404 }) : undefined));
    await fetchMissingTrackDetails(5);
    stub.mock.restore();
    const check = await checkImport(userId);
    assert.equal(check?.unknown, 60);
    assert.equal(check?.unusual, true);
  });

  it("finds plays at the same time", async () => {
    await saveImportedStreams(userId, plays(100, {}, 60_000));
    const check = await checkImport(userId);
    assert.equal(check?.overlapping, 99);
    assert.equal(check?.unusual, true);
  });

  it("finds days with more than 24 hours", async () => {
    for (let day = 0; day < 5; day++) {
      const rows = plays(150, { trackId: NEW, msPlayed: 600_000 }, 500_000).map((row) => ({
        ...row,
        playedAt: new Date(new Date(row.playedAt).getTime() + day * DAY_MS).toISOString(),
      }));
      await saveImportedStreams(userId, rows);
    }
    const check = await checkImport(userId);
    assert.ok((check?.impossibleDays ?? 0) >= 5);
    assert.equal(check?.unusual, true);
  });

  it("lets some of each pass", () => {
    const normal = { plays: 1000, checked: 500, tooLong: 10, unknown: 50, overlapping: 100, impossibleDays: 1 };
    assert.equal(isUnusual(normal), false);
    assert.equal(isUnusual({ ...normal, plays: 10, checked: 10, tooLong: 10, unknown: 0, overlapping: 0 }), false, "too few to say");
  });

  it("is done once a day, and forgotten when there's nothing left", async () => {
    await saveImportedStreams(userId, plays(10));
    assert.equal(await checkDueImports(5), 1);
    assert.equal(await checkDueImports(5), 0);
    await db.update(importChecks).set({ checkedAt: new Date(Date.now() - 2 * DAY_MS) });
    assert.equal(await checkDueImports(5), 1);

    await db.delete(streams);
    assert.equal(await checkImport(userId), null);
    assert.equal((await db.select().from(importChecks)).length, 0);
  });

  it("goes away with the account", async () => {
    await saveImportedStreams(userId, plays(10));
    await checkImport(userId);
    await db.delete(users).where(eq(users.id, userId));
    assert.equal((await db.select().from(importChecks)).length, 0);
  });
});
