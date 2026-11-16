// Counts attempts per key, in memory. The web app runs as one process, so all
// requests share it. A restart forgets the counts, which is fine for slowing
// down password guessing and email floods.
const windows = new Map<string, { count: number; resetsAt: number }>();
// Keys hold IP addresses and emails, so ended windows are dropped soon after
// (the Privacy Policy says IPs stay about an hour)
const SWEEP_EVERY_MS = 5 * 60_000;
let nextSweep = 0;

// True while `key` has been used at most `max` times in the current window
export function withinLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  if (now >= nextSweep || windows.size > 10_000) {
    nextSweep = now + SWEEP_EVERY_MS;
    for (const [oldKey, window] of windows) if (window.resetsAt <= now) windows.delete(oldKey);
  }
  const window = windows.get(key);
  if (!window || window.resetsAt <= now) {
    windows.set(key, { count: 1, resetsAt: now + windowMs });
    return true;
  }
  window.count++;
  return window.count <= max;
}

// For tests
export function clearLimits(): void {
  windows.clear();
}
