import assert from "node:assert/strict";
import { after, beforeEach, describe, it } from "node:test";
import { db } from "@/lib/db";
import { hiddenItems, tracks } from "@/lib/db/schema";
import { getAlbumTracks, getArtistAlbums, getArtistTracks } from "@/lib/stats";
import { addPlay, addTrack, closeDatabase, createUser, resetDatabase, spotifyId } from "./helpers";

const ARTIST = spotifyId("artist");
const ALBUM = spotifyId("album");
const OTHER_ALBUM = spotifyId("other");
const ONE = spotifyId("one");
const TWO = spotifyId("two");
const HIDDEN = spotifyId("hidden");
const UNPLAYED = spotifyId("unplayed");

after(closeDatabase);

describe("an artist's songs and albums, for visitors", () => {
  beforeEach(async () => {
    await resetDatabase();
    const user = await createUser();
    await addTrack(ONE, ARTIST, "Artist", ALBUM);
    await addTrack(TWO, ARTIST, "Artist", ALBUM);
    await addTrack(HIDDEN, ARTIST, "Artist", OTHER_ALBUM);
    await db.insert(tracks).values({ id: UNPLAYED, name: "Never played", albumId: ALBUM });
    await addPlay(user.id, ONE, "2026-08-15T10:00:00Z");
    await addPlay(user.id, TWO, "2026-08-15T11:00:00Z");
    await addPlay(user.id, TWO, "2026-08-15T12:00:00Z");
    await addPlay(user.id, HIDDEN, "2026-08-15T13:00:00Z");
    await db.insert(hiddenItems).values({ userId: user.id, type: "track", itemId: HIDDEN });
  });

  it("lists played songs, most played first, without hidden ones", async () => {
    const songs = await getArtistTracks(ARTIST, 10);
    assert.deepEqual(songs.map((song) => song.id), [TWO, ONE]);
    assert.equal(songs[0].subtitle, `Album ${ALBUM}`);
    assert.ok(!("plays" in songs[0]) && !("streams" in songs[0]), "no numbers for visitors");
  });

  it("lists albums that have plays nobody hid", async () => {
    const albums = await getArtistAlbums(ARTIST, 10);
    assert.deepEqual(albums.map((album) => album.id), [ALBUM]);
  });

  it("lists an album's played songs", async () => {
    const songs = await getAlbumTracks(ALBUM, 10);
    assert.deepEqual(songs.map((song) => song.id), [TWO, ONE]);
    assert.equal(songs[0].subtitle, "Artist");
  });
});
