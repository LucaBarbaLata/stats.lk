import assert from "node:assert/strict";
import { after, beforeEach, describe, it } from "node:test";
import { db } from "@/lib/db";
import { hiddenItems } from "@/lib/db/schema";
import { loadShareData } from "@/lib/share/data";
import { parseShareConfig } from "@/lib/share/options";
import { addPlay, addTrack, closeDatabase, createUser, resetDatabase, spotifyId } from "./helpers";

const ONE = spotifyId("one");
const TWO = spotifyId("two");
const ARTIST = spotifyId("artist");
const SECRET = spotifyId("secret");

after(closeDatabase);

describe("share card content", () => {
  let userId: string;

  beforeEach(async () => {
    await resetDatabase();
    userId = (await createUser()).id;
    await addTrack(ONE, ARTIST, "Artist");
    await addTrack(TWO, SECRET, "Hidden artist");
    // Three days in a row in Bucharest (UTC+3 in summer), the middle one the biggest
    await addPlay(userId, ONE, "2025-08-14T18:00:00Z", 60_000);
    await addPlay(userId, ONE, "2025-08-15T18:00:00Z", 120_000);
    await addPlay(userId, ONE, "2025-08-15T18:10:00Z", 120_000);
    await addPlay(userId, ONE, "2025-08-16T18:00:00Z", 60_000);
    await addPlay(userId, TWO, "2025-08-16T19:00:00Z", 600_000);
    await db.insert(hiddenItems).values({ userId, type: "artist", itemId: SECRET });
  });

  it("works out the custom card's stats for the period", async () => {
    const config = parseShareConfig(
      { card: "custom", period: "2025", stats: "minutes,plays,streak,busiest-day,peak-hour,top-artist" },
      2026,
    );
    const data = await loadShareData(userId, config);
    assert.equal(data.kind, "summary");
    if (data.kind !== "summary") return;
    assert.equal(data.subtitle, "2025");
    assert.deepEqual(data.values.minutes, { kind: "number", value: "16", label: "minutes listened" });
    assert.deepEqual(data.values.plays, { kind: "number", value: "5", label: "plays" });
    assert.deepEqual(data.values.streak, { kind: "number", value: "3", label: "days in a row" });
    // Totals count hidden plays: they don't say what was played
    assert.deepEqual(data.values["busiest-day"], { kind: "number", value: "11", label: "minutes on Aug 16, 2025" });
    assert.deepEqual(data.values["peak-hour"], { kind: "number", value: "22:00", label: "favourite hour" });
    // The hidden artist has more minutes, but stays off the card
    const top = data.values["top-artist"];
    assert.equal(top?.kind === "feature" && top.item?.id, ARTIST);
  });

  it("leaves hidden artists out of top lists", async () => {
    const data = await loadShareData(userId, parseShareConfig({ card: "top-artists", range: "all", layout: "grid" }, 2026));
    assert.equal(data.kind, "ranking");
    if (data.kind !== "ranking") return;
    assert.deepEqual(data.items.map((item) => item.id), [ARTIST]);
    assert.equal(data.title, "My top artists");
  });

  it("titles Wrapped with the year and its plays", async () => {
    const data = await loadShareData(userId, parseShareConfig({ card: "wrapped", year: "2025" }, 2026));
    assert.equal(data.title, "My 2025 Wrapped");
    assert.equal(data.subtitle, "5 plays");
  });
});
