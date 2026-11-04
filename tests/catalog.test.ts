import assert from "node:assert/strict";
import { after, afterEach, beforeEach, describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { fetchMissingCatalogDetails } from "@/lib/catalog";
import { db } from "@/lib/db";
import { artists, tracks, workerHeartbeat } from "@/lib/db/schema";
import { saveImportedStreams } from "@/lib/import/save";
import { fetchMissingPictures, findAlbumCover, findArtistPicture } from "@/lib/pictures";
import { closeDatabase, createUser, resetDatabase, spotifyId, stubFetch } from "./helpers";

const TRACK = spotifyId("t");

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function importOneTrack() {
  const user = await createUser();
  await saveImportedStreams(user.id, [
    { playedAt: "2020-05-01T08:00:00.000Z", trackId: TRACK, msPlayed: 180_000, trackName: "Song", artistName: "Band", albumName: "Record" },
  ]);
  await db.insert(workerHeartbeat).values({ id: 1, beatAt: new Date() });
}

after(closeDatabase);

describe("Spotify's rate limit", () => {
  let lookups = 0;
  let retryAfter = "1";
  let fetchStub: ReturnType<typeof stubFetch>;

  beforeEach(async () => {
    await resetDatabase();
    await importOneTrack();
    lookups = 0;
    retryAfter = "1";
    fetchStub = stubFetch((url) => {
      if (url.includes("/v1/tracks/") || url.includes("/v1/artists/")) {
        lookups++;
        return Response.json({}, { status: 429, headers: { "retry-after": retryAfter } });
      }
    });
  });
  afterEach(() => fetchStub.mock.restore());

  it("pauses lookups without failing the worker", async () => {
    await assert.doesNotReject(fetchMissingCatalogDetails(5));
    assert.equal(lookups, 1, "stops at the first refusal");

    const [heartbeat] = await db.select().from(workerHeartbeat);
    assert.ok(heartbeat.catalogPausedUntil, "the pause survives a restart");

    await fetchMissingCatalogDetails(5);
    assert.equal(lookups, 1, "Spotify isn't asked while paused");
  });

  it("carries on when the pause ends", async () => {
    await fetchMissingCatalogDetails(5);
    await sleep(1100);
    await fetchMissingCatalogDetails(5);
    assert.equal(lookups, 2);
  });

  it("keeps the track waiting for a later try", async () => {
    await fetchMissingCatalogDetails(5);
    const [track] = await db.select().from(tracks).where(eq(tracks.id, TRACK));
    assert.equal(track.detailsFetchedAt, null);
  });

  it("looks up artists before tracks, within the limit", async () => {
    await db.insert(artists).values({ id: spotifyId("real"), name: "Real artist" });
    await fetchMissingCatalogDetails(5);
    assert.ok(fetchStub.mock.calls.some((call) => String(call.arguments[0]).includes("/v1/artists/")));
    assert.ok(!fetchStub.mock.calls.some((call) => String(call.arguments[0]).includes("/v1/tracks/")));
  });
});

describe("pictures from Deezer", () => {
  beforeEach(resetDatabase);

  const artist = (name: string, hash = "abc") => ({
    name,
    picture_big: `https://cdn.example/images/artist/${hash}/500x500.jpg`,
  });
  const album = (title: string, artistName: string) => ({
    title,
    cover_big: `https://cdn.example/${title}.jpg`,
    artist: { name: artistName },
  });

  it("only takes an artist whose name matches", async () => {
    const stub = stubFetch(() => Response.json({ data: [artist("Jeanne"), artist("Nuanțe")] }));
    assert.match((await findArtistPicture("nuante")) ?? "", /abc/, "accents and case don't matter");
    stub.mock.restore();

    const noMatch = stubFetch(() => Response.json({ data: [artist("Jeanne")] }));
    assert.equal(await findArtistPicture("Nuanțe"), null);
    noMatch.mock.restore();
  });

  it("ignores artists without a photo", async () => {
    const stub = stubFetch(() => Response.json({ data: [{ name: "Band", picture_big: "https://cdn.example/images/artist//500x500.jpg" }] }));
    assert.equal(await findArtistPicture("Band"), null);
    stub.mock.restore();
  });

  it("finds a special edition of an album, but not another artist's", async () => {
    const stub = stubFetch(() =>
      Response.json({ data: [album("Hybrid Theory", "Someone Else"), album("Hybrid Theory (Bonus Edition)", "Linkin Park")] }),
    );
    assert.match((await findAlbumCover("Linkin Park", "Hybrid Theory")) ?? "", /Bonus/);
    stub.mock.restore();
  });

  it("reports Deezer's rate limit, which comes in a 200", async () => {
    const stub = stubFetch(() => Response.json({ error: { message: "Quota limit exceeded", code: 4 } }));
    await assert.rejects(findArtistPicture("Band"), /Quota/);
    stub.mock.restore();
  });

  it("marks what it looked up, found or not", async () => {
    await importOneTrack();
    const stub = stubFetch((url) => (url.includes("/search/artist") ? Response.json({ data: [artist("Band")] }) : Response.json({ data: [] })));
    assert.equal(await fetchMissingPictures(10), 2);
    stub.mock.restore();
    assert.equal(await fetchMissingPictures(10), 0, "nothing is looked up twice");
  });
});
