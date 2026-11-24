import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { SyncSchedule } from "@/lib/sync-schedule";

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const START = Date.UTC(2026, 10, 24, 12);
const GAP = 3 * MINUTE;

describe("when someone's plays are fetched", () => {
  let schedule: SyncSchedule;
  const playing = (trackId: string | null, at: number) => schedule.watch([{ userId: "ana", trackId }], START + at);
  const due = (at: number, syncedAt: number | null) =>
    schedule.isDue({ id: "ana", lastSyncedAt: syncedAt === null ? null : new Date(START + syncedAt) }, START + at);

  beforeEach(() => {
    schedule = new SyncSchedule(GAP);
  });

  it("at once for someone never synced", () => assert.equal(due(0, null), true));

  it("not while nothing changes", () => {
    playing("a", 0);
    playing("a", 5 * MINUTE);
    assert.equal(due(5 * MINUTE, 0), false);
  });

  it("when the track changes, once Spotify has had time to list it", () => {
    playing("a", 0);
    playing("b", 4 * MINUTE);
    assert.equal(due(4 * MINUTE, 0), false);
    assert.equal(due(4 * MINUTE + 15 * SECOND, 0), true);
  });

  it("when playback stops", () => {
    playing("a", 0);
    playing(null, 4 * MINUTE);
    assert.equal(due(4 * MINUTE + 15 * SECOND, 0), true);
  });

  it("not when playback starts, since nothing was played yet", () => {
    playing(null, 0);
    playing("a", 4 * MINUTE);
    assert.equal(due(5 * MINUTE, 0), false);
  });

  it("not more often than the gap", () => {
    playing("a", 0);
    playing("b", 1 * MINUTE);
    assert.equal(due(2 * MINUTE, 0), false);
    assert.equal(due(3 * MINUTE, 0), true);
  });

  it("not again for a track the web app already fetched", () => {
    playing("a", 0);
    playing("b", 4 * MINUTE);
    const syncedByWeb = 4 * MINUTE + 20 * SECOND;
    assert.equal(due(5 * MINUTE, syncedByWeb), false);
    assert.equal(due(10 * MINUTE, syncedByWeb), false);
  });

  it("even when someone skips all the time", () => {
    playing("t0", 0);
    for (let i = 1; i <= 20; i++) playing(`t${i}`, 4 * MINUTE + i * 5 * SECOND);
    assert.equal(due(4 * MINUTE + 100 * SECOND, 0), true);
  });

  it("every half an hour anyway", () => {
    assert.equal(due(29 * MINUTE, 0), false);
    assert.equal(due(30 * MINUTE, 0), true);
  });

  it("still after a pause Spotify asked for", () => {
    playing("a", 0);
    playing("b", 4 * MINUTE);
    assert.equal(due(6 * 60 * MINUTE, 0), true);
  });

  it("far less than every 3 minutes over a day", () => {
    let synced = 0;
    let requests = 0;
    // Three hours of music, a new track every 3.5 minutes, checked every 15 seconds
    for (let at = 0; at < 24 * 60 * MINUTE; at += 15 * SECOND) {
      const listening = at > 18 * 60 * MINUTE && at < 21 * 60 * MINUTE;
      playing(listening ? `t${Math.floor(at / (3.5 * MINUTE))}` : null, at);
      if (due(at, synced)) {
        requests++;
        synced = at;
      }
    }
    assert.ok(requests < 110, `${requests} requests`);
  });
});
