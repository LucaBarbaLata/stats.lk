import assert from "node:assert/strict";
import { after, beforeEach, describe, it } from "node:test";
import { db } from "@/lib/db";
import { hiddenItems, users } from "@/lib/db/schema";
import { getArtistLeaderboard } from "@/lib/social";
import { addPlay, addTrack, closeDatabase, resetDatabase, spotifyId } from "./helpers";

const ARTIST = spotifyId("artist");
const TRACK = spotifyId("track");

after(closeDatabase);

async function addUser(name: string, visibility: "private" | "friends" | "everyone" | "public") {
  const [user] = await db
    .insert(users)
    .values({ spotifyId: name, username: name, displayName: name, visibility })
    .returning();
  await addPlay(user.id, TRACK, "2026-08-15T12:00:00Z");
  return user;
}

describe("an artist's top listeners", () => {
  beforeEach(async () => {
    await resetDatabase();
    await addTrack(TRACK, ARTIST, "Artist");
  });

  it("shows visitors only public profiles", async () => {
    await addUser("open", "public");
    await addUser("members", "everyone");
    await addUser("closed", "private");
    const listeners = await getArtistLeaderboard(null, ARTIST, 10);
    assert.deepEqual(listeners.map((listener) => listener.username), ["open"]);
  });

  it("leaves out people who hid the artist", async () => {
    const user = await addUser("open", "public");
    await db.insert(hiddenItems).values({ userId: user.id, type: "artist", itemId: ARTIST });
    assert.equal((await getArtistLeaderboard(null, ARTIST, 10)).length, 0);
  });

  it("shows members everyone who shares with stats.lk, and themselves", async () => {
    await addUser("open", "public");
    await addUser("members", "everyone");
    const viewer = await addUser("closed", "private");
    const listeners = await getArtistLeaderboard(viewer.id, ARTIST, 10);
    assert.deepEqual(listeners.map((listener) => listener.username).sort(), ["closed", "members", "open"]);
  });
});
