import assert from "node:assert/strict";
import { after, beforeEach, describe, it } from "node:test";
import { addDays, startOfWeek, today } from "@/lib/dates";
import { getEras, getOnThisDay } from "@/lib/history";
import { comparePeriods } from "@/lib/periods";
import { weekdayOrder } from "@/lib/series";
import { db } from "@/lib/db";
import { spotifyTokens } from "@/lib/db/schema";
import { presetRange, rangeLabel } from "@/lib/ranges";
import { getDailyMinutes, getPlaysOnDay, getStatsEnd, getTopArtists } from "@/lib/stats";
import { addPlay, addTrack, closeDatabase, createUser, resetDatabase, spotifyId } from "./helpers";

const ONE = spotifyId("one");
const TWO = spotifyId("two");
const HOURS = 60 * 60 * 1000;

after(closeDatabase);

describe("a day's plays", () => {
  beforeEach(resetDatabase);

  it("follows the user's time zone, oldest first", async () => {
    const user = await createUser();
    await addTrack(ONE, spotifyId("a"), "Artist");
    await addPlay(user.id, ONE, "2026-08-14T20:30:00Z"); // 23:30 in Bucharest, still the 14th
    await addPlay(user.id, ONE, "2026-08-14T21:30:00Z"); // 00:30 on the 15th in Bucharest
    await addPlay(user.id, ONE, "2026-08-15T20:30:00Z"); // 23:30 on the 15th

    const bucharest = await getPlaysOnDay(user.id, "2026-08-15", "Europe/Bucharest");
    assert.deepEqual(bucharest.map((play) => play.time), ["00:30", "23:30"]);

    const utc = await getPlaysOnDay(user.id, "2026-08-15", "UTC");
    assert.deepEqual(utc.map((play) => play.time), ["20:30"]);
  });

  it("counts days back from the last play for accounts without Spotify", async () => {
    const user = await createUser();
    await addTrack(ONE, spotifyId("a"), "Artist");
    await addPlay(user.id, ONE, "2025-03-01T12:00:00Z");
    await addPlay(user.id, ONE, "2025-03-10T12:00:00Z");
    await addPlay(user.id, ONE, "2025-03-20T12:00:00Z");

    assert.equal((await getDailyMinutes(user.id, 15)).length, 0, "nothing in the last 15 days");
    const days = await getDailyMinutes(user.id, 15, new Date("2025-03-20T12:00:00Z"));
    assert.deepEqual(days.map((day) => day.key), ["2025-03-10", "2025-03-20"]);
  });

  it("names the artist and has nothing for an empty day", async () => {
    const user = await createUser();
    await addTrack(ONE, spotifyId("a"), "Artist");
    await addPlay(user.id, ONE, "2026-08-15T12:00:00Z");
    const [play] = await getPlaysOnDay(user.id, "2026-08-15", "UTC");
    assert.equal(play.artistNames, "Artist");
    assert.equal((await getPlaysOnDay(user.id, "2026-08-16", "UTC")).length, 0);
  });

  it("only shows the user's own plays", async () => {
    const user = await createUser();
    await addTrack(ONE, spotifyId("a"), "Artist");
    await addPlay(user.id, ONE, "2026-08-15T12:00:00Z");
    assert.equal((await getPlaysOnDay("00000000-0000-4000-8000-000000000000", "2026-08-15", "UTC")).length, 0);
  });
});

describe("on this day", () => {
  beforeEach(resetDatabase);

  it("finds this date in earlier years, with that day's top track", async () => {
    const user = await createUser();
    await addTrack(ONE, spotifyId("a"), "Artist");
    await addTrack(TWO, spotifyId("b"), "Other");
    const day = today();
    const lastYear = `${Number(day.slice(0, 4)) - 1}${day.slice(4)}`;
    await addPlay(user.id, ONE, `${lastYear}T09:00:00Z`);
    await addPlay(user.id, TWO, `${lastYear}T10:00:00Z`);
    await addPlay(user.id, TWO, `${lastYear}T11:00:00Z`);
    await addPlay(user.id, ONE, `${day}T09:00:00Z`); // today doesn't count

    const days = await getOnThisDay(user.id, 3);
    assert.equal(days.length, 1);
    assert.equal(days[0].plays, 3);
    assert.equal(days[0].trackId, TWO);
  });
});

describe("eras", () => {
  beforeEach(resetDatabase);

  const lots = async (userId: string, trackId: string, month: string, hours = 3) =>
    addPlay(userId, trackId, `2025-${month}-15T12:00:00Z`, hours * HOURS);

  it("joins months in a row with the same top artist, newest first", async () => {
    const user = await createUser();
    await addTrack(ONE, spotifyId("a"), "Artist one");
    await addTrack(TWO, spotifyId("b"), "Artist two");
    await lots(user.id, ONE, "01");
    await lots(user.id, ONE, "02");
    await lots(user.id, TWO, "03");

    const eras = await getEras(user.id);
    assert.deepEqual(
      eras.map((era) => [era.artistName, era.from, era.to, era.months]),
      [
        ["Artist two", "2025-03", "2025-03", 1],
        ["Artist one", "2025-01", "2025-02", 2],
      ],
    );
    assert.equal(eras[1].share, 100);
  });

  it("skips quiet months", async () => {
    const user = await createUser();
    await addTrack(ONE, spotifyId("a"), "Artist one");
    await addTrack(TWO, spotifyId("b"), "Artist two");
    await lots(user.id, ONE, "01");
    await lots(user.id, TWO, "02", 1); // under two hours
    await lots(user.id, ONE, "03");

    const eras = await getEras(user.id);
    assert.equal(eras.length, 1);
    assert.equal(eras[0].months, 2);
  });
});

describe("the start of the week", () => {
  // 2026-11-04 is a Wednesday
  it("depends on the user's setting", () => {
    assert.equal(startOfWeek("2026-11-04", 1), "2026-11-02");
    assert.equal(startOfWeek("2026-11-04", 7), "2026-11-01");
    assert.equal(startOfWeek("2026-11-01", 7), "2026-11-01", "a Sunday starts its own week");
    assert.equal(startOfWeek("2026-11-01", 1), addDays("2026-11-01", -6));
  });

  it("orders the weekday chart", () => {
    assert.deepEqual(weekdayOrder(1), [1, 2, 3, 4, 5, 6, 7]);
    assert.deepEqual(weekdayOrder(7), [7, 1, 2, 3, 4, 5, 6]);
  });

  it("sets where this week begins in Compare", () => {
    const { current, previous } = comparePeriods("week", "2026-11-04", 7);
    assert.ok(current.key === "custom" && current.from === "2026-11-01");
    assert.ok(previous.key === "custom" && previous.from === "2026-10-25");
  });
});

describe("ranges for accounts without Spotify", () => {
  beforeEach(resetDatabase);

  it("end at the newest play, so short ranges still show something", async () => {
    const user = await createUser();
    await addTrack(ONE, spotifyId("a"), "Artist");
    await addPlay(user.id, ONE, "2025-03-01T12:00:00Z");
    await addPlay(user.id, ONE, "2025-03-20T12:00:00Z");

    const end = await getStatsEnd(user.id);
    assert.equal(end.live, false);
    assert.equal(end.endsAt?.toISOString(), "2025-03-20T12:00:00.000Z");

    assert.equal((await getTopArtists(user.id, presetRange("4w"), "plays", 5)).length, 0, "nothing in the 4 weeks to today");
    const [artist] = await getTopArtists(user.id, presetRange("4w", end.endsAt), "plays", 5);
    assert.equal(artist.streams, 2);
    assert.equal(rangeLabel(presetRange("4w", end.endsAt)), "4 weeks to Mar 20, 2025");
    assert.equal(rangeLabel(presetRange("4w")), "Last 4 weeks");
    assert.equal(rangeLabel(presetRange("all", end.endsAt)), "All time");
  });

  it("end now with Spotify connected, and for accounts with no plays", async () => {
    const user = await createUser();
    assert.deepEqual(await getStatsEnd(user.id), { live: false, endsAt: null });
    await addTrack(ONE, spotifyId("a"), "Artist");
    await addPlay(user.id, ONE, "2025-03-20T12:00:00Z");
    await db.insert(spotifyTokens).values({ userId: user.id, accessToken: "a", refreshToken: "r", expiresAt: new Date(), scope: "" });
    assert.deepEqual(await getStatsEnd(user.id), { live: true, endsAt: null });
  });
});
