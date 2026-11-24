import assert from "node:assert/strict";
import { after, afterEach, beforeEach, describe, it, mock } from "node:test";
import { eq } from "drizzle-orm";
import { encrypt } from "@/lib/crypto";
import { db } from "@/lib/db";
import { nowPlaying, spotifyPauses, spotifyTokens, streams, users } from "@/lib/db/schema";
import { refreshNowPlaying, staleNowPlayingUsers } from "@/lib/now-playing";
import { SpotifyError } from "@/lib/spotify/api";
import { activePauses, pauseCall, pausedUntil } from "@/lib/spotify/pauses";
import { syncUser } from "@/lib/sync";
import { closeDatabase, createUser, resetDatabase, spotifyId, spotifyTrack, stubFetch } from "./helpers";

const TRACK = spotifyId("t");
const song = () => spotifyTrack(TRACK, { id: spotifyId("a"), name: "Band" }, { id: spotifyId("album"), name: "Record" });

const refused = (body: unknown, retryAfter?: string) =>
  Response.json(body, { status: 429, headers: retryAfter ? { "retry-after": retryAfter } : {} });

// The body Spotify documents for a used up quota
const QUOTA = { error: { status: 429, message: "Too many requests", reason: "QUOTA_EXCEEDED" } };

async function connectedUser() {
  const user = await createUser();
  await db.insert(spotifyTokens).values({
    userId: user.id,
    accessToken: encrypt("fake"),
    refreshToken: encrypt("fake"),
    expiresAt: new Date(Date.now() + 3_600_000),
    scope: "user-read-currently-playing",
  });
  return user;
}

const is429 = (error: unknown) => error instanceof SpotifyError && error.status === 429;

after(closeDatabase);

describe("pauses Spotify asks for", () => {
  let answer: (url: string) => Response | undefined;
  let asked: string[];
  let fetchStub: ReturnType<typeof stubFetch>;
  let warned: ReturnType<typeof mock.method>;

  beforeEach(async () => {
    await resetDatabase();
    asked = [];
    answer = () => undefined;
    fetchStub = stubFetch((url) => {
      asked.push(url);
      return answer(url);
    });
    warned = mock.method(console, "warn", () => {});
  });
  afterEach(() => {
    fetchStub.mock.restore();
    warned.mock.restore();
  });

  it("keeps saving plays while now playing is refused", async () => {
    const user = await connectedUser();
    answer = (url) =>
      url.includes("currently-playing")
        ? refused(QUOTA, "15631")
        : Response.json({ items: [{ track: song(), played_at: "2026-11-24T12:00:00.000Z" }] });

    await assert.rejects(refreshNowPlaying(user.id), is429);
    assert.equal(await syncUser(user.id), 1);
    assert.equal((await db.select().from(streams)).length, 1);
  });

  it("doesn't ask again until the pause ends", async () => {
    const user = await connectedUser();
    answer = () => refused(QUOTA, "15631");
    await assert.rejects(refreshNowPlaying(user.id), is429);
    await assert.rejects(refreshNowPlaying(user.id), is429);
    assert.equal(asked.length, 1);
  });

  it("waits as long as Spotify says", async () => {
    const user = await connectedUser();
    answer = () => refused(QUOTA, "15631");
    await assert.rejects(refreshNowPlaying(user.id), is429);
    const until = await pausedUntil("now-playing");
    assert.ok(until);
    assert.ok(Math.abs(until.getTime() - Date.now() - 15_631_000) < 5_000);
  });

  it("waits 30 seconds when Spotify doesn't say", async () => {
    const user = await connectedUser();
    answer = () => refused({});
    await assert.rejects(refreshNowPlaying(user.id), is429);
    const until = await pausedUntil("now-playing");
    assert.ok(until);
    assert.ok(Math.abs(until.getTime() - Date.now() - 30_000) < 5_000);
  });

  it("records Spotify's own reason", async () => {
    const user = await connectedUser();
    answer = () => refused(QUOTA, "60");
    await assert.rejects(refreshNowPlaying(user.id), (error) => is429(error) && (error as SpotifyError).code === "QUOTA_EXCEEDED");
    assert.deepEqual(
      (await activePauses()).map(({ call, reason }) => ({ call, reason })),
      [{ call: "now-playing", reason: "QUOTA_EXCEEDED" }],
    );
    assert.match(String(warned.mock.calls[0].arguments[0]), /now-playing requests \(QUOTA_EXCEEDED\)/);
  });

  it("says so when Spotify gives no reason", async () => {
    const user = await connectedUser();
    answer = () => refused({ error: { status: 429, message: "API rate limit exceeded" } }, "60");
    await assert.rejects(refreshNowPlaying(user.id), is429);
    assert.equal((await activePauses())[0].reason, "no reason given");
  });

  it("asks again once the pause is over", async () => {
    const user = await connectedUser();
    await pauseCall("now-playing", 60, "QUOTA_EXCEEDED");
    await db.update(spotifyPauses).set({ until: new Date(Date.now() - 1000) });
    answer = () => new Response(null, { status: 204 });
    await refreshNowPlaying(user.id);
    assert.equal(asked.length, 1);
    assert.deepEqual(await activePauses(), []);
  });

  it("keeps the longer of two waits", async () => {
    await pauseCall("now-playing", 3600, "QUOTA_EXCEEDED");
    await pauseCall("now-playing", 5, "no reason given");
    const until = await pausedUntil("now-playing");
    assert.ok(until && until.getTime() - Date.now() > 3_500_000);
  });

  it("doesn't count a pause as a failed sync", async () => {
    const user = await connectedUser();
    answer = () => refused(QUOTA, "60");
    await assert.rejects(syncUser(user.id), is429);
    const [row] = await db.select().from(users).where(eq(users.id, user.id));
    assert.equal(row.syncError, null);
    assert.equal(row.lastSyncedAt, null, "still due, so it's synced as soon as the pause ends");
  });
});

describe("who the worker asks about", () => {
  beforeEach(resetDatabase);

  async function seen(isPlaying: boolean, secondsAgo: number) {
    const user = await connectedUser();
    await db.insert(nowPlaying).values({ userId: user.id, isPlaying, fetchedAt: new Date(Date.now() - secondsAgo * 1000) });
    return (await staleNowPlayingUsers(30_000, 90_000)).includes(user.id);
  }

  it("asks often about someone listening", async () => assert.equal(await seen(true, 40), true));
  it("asks less often about someone who isn't", async () => assert.equal(await seen(false, 40), false));
  it("still notices when they start", async () => assert.equal(await seen(false, 100), true));

  it("asks right away about someone new", async () => {
    const user = await connectedUser();
    assert.deepEqual(await staleNowPlayingUsers(30_000, 90_000), [user.id]);
  });
});
