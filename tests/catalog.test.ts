import assert from "node:assert/strict";
import { after, afterEach, beforeEach, describe, it, mock } from "node:test";
import { eq } from "drizzle-orm";
import { fetchMissingArtistDetails, fetchMissingCatalogDetails, upsertArtists } from "@/lib/catalog";
import { encrypt } from "@/lib/crypto";
import { db } from "@/lib/db";
import { artists, spotifyTokens, trackArtists, tracks, users, workerHeartbeat } from "@/lib/db/schema";
import { saveImportedStreams } from "@/lib/import/save";
import { fetchMissingPictures, findAlbumCover, findArtistPicture } from "@/lib/pictures";
import { refreshTopLists } from "@/lib/spotify/top";
import { addPlay, addTrack, closeDatabase, createUser, resetDatabase, spotifyId, spotifyTrack, stubFetch } from "./helpers";

const TRACK = spotifyId("t");

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function importOneTrack() {
  const user = await createUser();
  await saveImportedStreams(user.id, [
    { playedAt: "2020-05-01T08:00:00.000Z", trackId: TRACK, msPlayed: 180_000, trackName: "Song", artistName: "Band", albumName: "Record" },
  ]);
  await db.insert(workerHeartbeat).values({ id: 1, beatAt: new Date() });
  return user;
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
  const track = (title: string, artistName: string, hash: string) => ({ title, artist: artist(artistName, hash) });
  const album = (title: string, artistName: string) => ({
    title,
    cover_big: `https://cdn.example/${title}.jpg`,
    artist: { name: artistName },
  });

  it("picks the artist who made the played track, not a namesake", async () => {
    const stub = stubFetch(() =>
      Response.json({ data: [track("Other song", "Band", "wrong"), track("Our Song (feat. Someone) - Remastered 2021", "Band", "right")] }),
    );
    assert.match((await findArtistPicture("Band", ["Our Song - Remastered"])) ?? "", /right/);
    stub.mock.restore();
  });

  it("ignores accents and case when comparing", async () => {
    const stub = stubFetch(() => Response.json({ data: [track("Singurătate", "ALTERNOSFERA", "right")] }));
    assert.match((await findArtistPicture("Alternosfera", ["Singuratate"])) ?? "", /right/);
    stub.mock.restore();
  });

  it("trusts a name alone only when one artist has it", async () => {
    const unique = stubFetch((url) =>
      url.includes("/search/artist") ? Response.json({ data: [artist("Jeanne"), artist("Nuanțe")] }) : Response.json({ data: [] }),
    );
    assert.match((await findArtistPicture("nuante", ["Unfound"])) ?? "", /abc/);
    unique.mock.restore();

    const namesakes = stubFetch((url) =>
      url.includes("/search/artist") ? Response.json({ data: [artist("Band", "one"), artist("Band", "two")] }) : Response.json({ data: [] }),
    );
    assert.equal(await findArtistPicture("Band", ["Unfound"]), null, "a wrong photo is worse than none");
    namesakes.mock.restore();
  });

  it("ignores artists without a photo", async () => {
    const stub = stubFetch(() => Response.json({ data: [{ name: "Band", picture_big: "https://cdn.example/images/artist//500x500.jpg" }] }));
    assert.equal(await findArtistPicture("Band", []), null);
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
    await assert.rejects(findArtistPicture("Band", []), /Quota/);
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

describe("Spotify's own artist photos", () => {
  const REAL_ID = spotifyId("realartist");
  const OTHER_ID = spotifyId("otherartist");
  const PHOTO = "https://i.scdn.co/image/official";
  const DEEZER_PICTURE = "https://cdn.example/images/artist/abc/500x500.jpg";
  const band = (images: { url: string; width: number; height: number }[] = [{ url: PHOTO, width: 640, height: 640 }]) => ({
    id: REAL_ID,
    name: "Band",
    images,
  });
  const artistRow = async (id: string) => (await db.select().from(artists).where(eq(artists.id, id)))[0];
  const artistsOfTrack = async (trackId: string) =>
    (await db.select().from(trackArtists).where(eq(trackArtists.trackId, trackId))).map((row) => row.artistId);

  beforeEach(resetDatabase);

  // An import whose made-up artist already got a picture from Deezer
  async function importWithDeezerPicture() {
    const user = await importOneTrack();
    await db.update(artists).set({ imageUrl: DEEZER_PICTURE }).where(eq(artists.imported, true));
    return user;
  }

  it("takes over a made-up artist from a top list, photo and plays", async () => {
    await importWithDeezerPicture();
    await upsertArtists([band()]);

    assert.deepEqual(await artistsOfTrack(TRACK), [REAL_ID]);
    const real = await artistRow(REAL_ID);
    assert.equal(real.imageUrl, PHOTO);
    assert.ok(real.detailsFetchedAt, "no lookup is needed anymore");
    assert.equal((await db.select().from(artists).where(eq(artists.imported, true))).length, 0);
  });

  it("keeps the Deezer picture of an artist Spotify has no photo for", async () => {
    await importWithDeezerPicture();
    await upsertArtists([band([])]);
    assert.equal((await artistRow(REAL_ID)).imageUrl, DEEZER_PICTURE);

    await upsertArtists([band([])]);
    assert.equal((await artistRow(REAL_ID)).imageUrl, DEEZER_PICTURE, "also once it's a real artist");
  });

  it("still asks Spotify about an artist Deezer has a picture for", async () => {
    const user = await createUser();
    await addTrack(TRACK, REAL_ID, "Band");
    await addPlay(user.id, TRACK, "2020-05-01T08:00:00.000Z");

    const deezer = stubFetch((url) =>
      Response.json({ data: url.includes("/search/artist") ? [{ name: "Band", picture_big: DEEZER_PICTURE }] : [] }),
    );
    await fetchMissingPictures(10);
    deezer.mock.restore();
    assert.equal((await artistRow(REAL_ID)).imageUrl, DEEZER_PICTURE);

    const spotify = stubFetch((url) => (url.includes("/v1/artists/") ? Response.json(band()) : undefined));
    assert.equal(await fetchMissingArtistDetails(5), 1);
    spotify.mock.restore();
    assert.equal((await artistRow(REAL_ID)).imageUrl, PHOTO);
  });

  it("looks up the most played artists first", async () => {
    const user = await createUser();
    await addTrack(spotifyId("quiet"), OTHER_ID, "Quiet");
    await addTrack(spotifyId("loud"), REAL_ID, "Band");
    await addPlay(user.id, spotifyId("quiet"), "2020-05-01T08:00:00.000Z");
    await addPlay(user.id, spotifyId("loud"), "2020-05-01T09:00:00.000Z");
    await addPlay(user.id, spotifyId("loud"), "2020-05-01T10:00:00.000Z");

    const stub = stubFetch((url) => (url.includes("/v1/artists/") ? Response.json(band()) : undefined));
    await fetchMissingArtistDetails(1);
    assert.ok(String(stub.mock.calls.at(-1)?.arguments[0]).endsWith(`/artists/${REAL_ID}`));
    stub.mock.restore();
  });

  describe("top lists", () => {
    async function connect(userId: string) {
      await db.insert(spotifyTokens).values({
        userId,
        accessToken: encrypt("fake"),
        refreshToken: encrypt("fake"),
        expiresAt: new Date(Date.now() + 3_600_000),
        scope: "user-top-read",
      });
    }

    it("stores every range and links what was imported", async () => {
      const user = await importWithDeezerPicture();
      await connect(user.id);
      const stub = stubFetch((url) => {
        if (url.includes("/me/top/artists")) return Response.json({ items: [band()] });
        if (url.includes("/me/top/tracks")) {
          return Response.json({ items: [spotifyTrack(TRACK, { id: REAL_ID, name: "Band" }, { id: spotifyId("album"), name: "Record" })] });
        }
      });
      await refreshTopLists(user.id);
      assert.equal(stub.mock.callCount(), 6, "tracks and artists for three ranges");
      stub.mock.restore();

      assert.deepEqual(await artistsOfTrack(TRACK), [REAL_ID]);
      assert.equal((await artistRow(REAL_ID)).imageUrl, PHOTO);
      const [row] = await db.select().from(users).where(eq(users.id, user.id));
      assert.ok(row.topListsFetchedAt);
    });

    it("lets a refusal pass, so syncing isn't paused for it", async () => {
      const user = await importWithDeezerPicture();
      await connect(user.id);
      const logged = mock.method(console, "error", () => {});
      const stub = stubFetch(() => Response.json({}, { status: 429, headers: { "retry-after": "86400" } }));
      await assert.doesNotReject(refreshTopLists(user.id));
      stub.mock.restore();
      logged.mock.restore();

      const [row] = await db.select().from(users).where(eq(users.id, user.id));
      assert.ok(row.topListsFetchedAt, "waits for the next round");
    });
  });
});
