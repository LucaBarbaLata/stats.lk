import assert from "node:assert/strict";
import { after, beforeEach, describe, it } from "node:test";
import { eq, sql } from "drizzle-orm";
import { topLiveArtists } from "@/lib/community";
import { db } from "@/lib/db";
import { hiddenItems, streams, users } from "@/lib/db/schema";
import { addPlay, addTrack, closeDatabase, createUser, resetDatabase, spotifyId } from "./helpers";

const LIVE = spotifyId("live");
const IMPORTED = spotifyId("imported");
const always = sql`true`;

after(closeDatabase);

describe("top artists on the home page", () => {
  let userId: string;

  async function livePlay(trackId: string, playedAt: string) {
    await db.insert(streams).values({ userId, trackId, playedAt: new Date(playedAt), msPlayed: 180_000, source: "api" });
  }

  beforeEach(async () => {
    await resetDatabase();
    userId = (await createUser()).id;
    await db.update(users).set({ visibility: "everyone" });
    await addTrack(LIVE, spotifyId("band"), "Band");
    await addTrack(IMPORTED, spotifyId("fake"), "Fake");
    await livePlay(LIVE, "2026-11-20T10:00:00Z");
  });

  const names = async () => (await topLiveArtists(always, 5)).map((artist) => artist.name);

  it("only count plays Spotify reported, not imports", async () => {
    for (let hour = 10; hour < 20; hour++) await addPlay(userId, IMPORTED, `2026-11-20T${hour}:30:00Z`);
    assert.deepEqual(await names(), ["Band"]);
  });

  it("leave out private profiles", async () => {
    await db.update(users).set({ visibility: "private" }).where(eq(users.id, userId));
    assert.deepEqual(await names(), []);
  });

  it("leave out what people hid", async () => {
    await db.insert(hiddenItems).values({ userId, type: "artist", itemId: spotifyId("band") });
    assert.deepEqual(await names(), []);
  });

  it("don't let an import stretch a live play", async () => {
    await db.execute(sql`update tracks set duration_ms = 180000`);
    await db.execute(sql`update streams set ms_played = 3600000`);
    assert.equal((await topLiveArtists(always, 5))[0].minutes, 3);
  });
});
