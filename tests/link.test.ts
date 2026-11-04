import assert from "node:assert/strict";
import { after, beforeEach, describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { upsertTracks } from "@/lib/catalog";
import { db } from "@/lib/db";
import { albums, artists, hiddenItems, trackArtists, tracks } from "@/lib/db/schema";
import { linkImportedTracks } from "@/lib/import/link";
import { saveImportedStreams } from "@/lib/import/save";
import { PRESETS } from "@/lib/ranges";
import { getTopAlbums, getTopArtists } from "@/lib/stats";
import { closeDatabase, createUser, resetDatabase, spotifyId, spotifyTrack } from "./helpers";

const ALL_TIME = PRESETS[3];
const A = spotifyId("a");
const B = spotifyId("b");
const C = spotifyId("c");
const REAL_ARTIST = { id: spotifyId("ra"), name: "Test Band" };
const REAL_ALBUM = { id: spotifyId("rb"), name: "Test Album", imageUrl: "https://example.com/album.jpg" };

const row = (trackId: string, hour: number, artistName: string, albumName: string) => ({
  playedAt: `2022-03-01T${String(hour).padStart(2, "0")}:00:00.000Z`,
  trackId,
  msPlayed: 180_000,
  trackName: `Track ${trackId}`,
  artistName,
  albumName,
});

const artistsOf = async (trackId: string) =>
  (await db.select().from(trackArtists).where(eq(trackArtists.trackId, trackId))).map((link) => link.artistId);
const albumOf = async (trackId: string) => (await db.select().from(tracks).where(eq(tracks.id, trackId)))[0].albumId;

after(closeDatabase);

describe("imported names", () => {
  beforeEach(resetDatabase);

  it("links imported tracks to artists and albums at once", async () => {
    const user = await createUser();
    await saveImportedStreams(user.id, [row(A, 8, "Test Band", "Test Album"), row(B, 9, "TEST BAND", "test album")]);

    const [artistA] = await artistsOf(A);
    assert.ok(artistA, "the track has an artist");
    assert.deepEqual(await artistsOf(B), [artistA], "names differing in case are one artist");
    assert.ok(await albumOf(A));
    assert.equal(await albumOf(B), await albumOf(A), "both tracks share one album");

    const [artist] = await db.select().from(artists).where(eq(artists.id, artistA));
    assert.equal(artist.imported, true);

    const topArtists = await getTopArtists(user.id, ALL_TIME, "plays", 5);
    assert.equal(topArtists[0].streams, 2, "top artists count imported plays");
    const topAlbums = await getTopAlbums(user.id, ALL_TIME, "plays", 5);
    assert.equal(topAlbums[0].streams, 2, "top albums count imported plays");
  });

  it("prefers an artist Spotify already gave us", async () => {
    const user = await createUser();
    await db.insert(artists).values({ id: REAL_ARTIST.id, name: REAL_ARTIST.name });
    await saveImportedStreams(user.id, [row(A, 8, "Test Band", "Test Album")]);
    assert.deepEqual(await artistsOf(A), [REAL_ARTIST.id]);
  });

  it("doesn't change anything when linking twice", async () => {
    const user = await createUser();
    await saveImportedStreams(user.id, [row(A, 8, "Test Band", "Test Album")]);
    const before = await artistsOf(A);
    await linkImportedTracks();
    assert.deepEqual(await artistsOf(A), before);
  });

  it("swaps made-up rows for the real ones and keeps what was found", async () => {
    const user = await createUser();
    await saveImportedStreams(user.id, [row(A, 8, "Test Band", "Test Album"), row(B, 9, "Test Band", "Test Album")]);
    const [madeUpArtist] = await artistsOf(A);
    const madeUpAlbum = (await albumOf(A)) as string;
    await db
      .update(artists)
      .set({ imageUrl: "https://example.com/artist.jpg", genres: ["rock"], genresFetchedAt: new Date() })
      .where(eq(artists.id, madeUpArtist));
    await db.insert(hiddenItems).values({ userId: user.id, type: "artist", itemId: madeUpArtist });

    // Spotify answers for one track only
    await upsertTracks([spotifyTrack(A, REAL_ARTIST, REAL_ALBUM)]);

    assert.deepEqual(await artistsOf(A), [REAL_ARTIST.id]);
    assert.deepEqual(await artistsOf(B), [REAL_ARTIST.id], "the other track moves too");
    assert.equal(await albumOf(B), REAL_ALBUM.id);
    assert.equal((await db.select().from(artists).where(eq(artists.id, madeUpArtist))).length, 0);
    assert.equal((await db.select().from(albums).where(eq(albums.id, madeUpAlbum))).length, 0);

    const [real] = await db.select().from(artists).where(eq(artists.id, REAL_ARTIST.id));
    assert.equal(real.imageUrl, "https://example.com/artist.jpg");
    assert.deepEqual(real.genres, ["rock"]);
    assert.equal(real.detailsFetchedAt, null, "Spotify's own photo is still looked up");

    const hidden = await db.select().from(hiddenItems).where(eq(hiddenItems.userId, user.id));
    assert.deepEqual(hidden.map((item) => item.itemId), [REAL_ARTIST.id], "a hidden artist stays hidden");
  });

  it("leaves nothing behind when Spotify gives other names", async () => {
    const user = await createUser();
    await saveImportedStreams(user.id, [row(C, 10, "Old Name", "Old Album")]);
    const [madeUpArtist] = await artistsOf(C);
    const madeUpAlbum = (await albumOf(C)) as string;

    await upsertTracks([
      spotifyTrack(C, { id: spotifyId("rc"), name: "New Name" }, { id: spotifyId("rd"), name: "New Album" }),
    ]);

    assert.equal((await db.select().from(artists).where(eq(artists.id, madeUpArtist))).length, 0);
    assert.equal((await db.select().from(albums).where(eq(albums.id, madeUpAlbum))).length, 0);
  });

  it("keeps the real artist when the same file is imported again", async () => {
    const user = await createUser();
    await saveImportedStreams(user.id, [row(A, 8, "Test Band", "Test Album")]);
    await upsertTracks([spotifyTrack(A, REAL_ARTIST, REAL_ALBUM)]);
    await saveImportedStreams(user.id, [row(A, 11, "Test Band", "Test Album")]);
    assert.deepEqual(await artistsOf(A), [REAL_ARTIST.id]);
  });

  it("doesn't touch other artists whose names look alike", async () => {
    const user = await createUser();
    await saveImportedStreams(user.id, [row(A, 8, "ZZ Top", "Eliminator"), row(B, 9, "Test Band", "Test Album")]);
    await upsertTracks([spotifyTrack(B, REAL_ARTIST, REAL_ALBUM)]);
    const [zzTop] = await artistsOf(A);
    assert.equal((await db.select().from(artists).where(eq(artists.id, zzTop)))[0].name, "ZZ Top");
  });
});
