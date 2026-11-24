// Decides when the worker asks Spotify for someone's recent plays. Asking every
// few minutes all day used up Spotify's quota (November 2026), and nearly all of
// it was for people who weren't listening. Now playing has a quota of its own,
// so it tells when a track ended and there's something new to fetch.

// Spotify lists a play a few seconds after the next one starts
const AFTER_CHANGE_MS = 10_000;
// Plays now playing can't show (offline listening, the same track on repeat, or
// now playing itself refused) are picked up this often. Spotify keeps the last
// 50, so nothing is lost meanwhile.
const SAFETY_MS = 30 * 60_000;

export class SyncSchedule {
  private playing = new Map<string, string | null>();
  // When the first track ended that hasn't been fetched yet
  private endedAt = new Map<string, number>();

  // At most one request per user in this time
  constructor(private readonly minGapMs: number) {}

  // What everyone is playing, whoever refreshed it (the worker or the web app)
  watch(rows: Iterable<{ userId: string; trackId: string | null }>, now = Date.now()): void {
    for (const { userId, trackId } of rows) {
      const before = this.playing.get(userId);
      if (before && before !== trackId && !this.endedAt.has(userId)) this.endedAt.set(userId, now);
      this.playing.set(userId, trackId);
    }
  }

  isDue(user: { id: string; lastSyncedAt: Date | null }, now = Date.now()): boolean {
    if (!user.lastSyncedAt) return true;
    const syncedAt = user.lastSyncedAt.getTime();
    if (now - syncedAt >= Math.max(SAFETY_MS, this.minGapMs)) return true;

    const endedAt = this.endedAt.get(user.id);
    if (endedAt === undefined) return false;
    if (syncedAt >= endedAt + AFTER_CHANGE_MS) {
      // Fetched since, by the worker or the web app
      this.endedAt.delete(user.id);
      return false;
    }
    return now - endedAt >= AFTER_CHANGE_MS && now - syncedAt >= this.minGapMs;
  }
}
