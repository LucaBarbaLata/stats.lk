"use server";

import { getImportProgress, type ImportProgressData } from "@/lib/import/progress";
import { ImportLimitError, saveImportedStreams, validateRows } from "@/lib/import/save";
import { getCurrentUser } from "@/lib/session";

// At most this many chunks per user per minute: a real import of a few
// hundred thousand plays takes a couple of minutes at this pace
const CHUNKS_PER_MINUTE = 300;
const recentChunks = new Map<string, number[]>();

function tooFast(userId: string): boolean {
  const now = Date.now();
  const recent = (recentChunks.get(userId) ?? []).filter((time) => now - time < 60_000);
  recent.push(now);
  recentChunks.set(userId, recent);
  return recent.length > CHUNKS_PER_MINUTE;
}

export type ImportChunkResult = { added: number; merged: number } | { error: string };

// Polled by the progress bar on the import page and the dashboard
export async function pollImportProgress(): Promise<ImportProgressData | null> {
  const user = await getCurrentUser();
  return user ? getImportProgress(user.id) : null;
}

// Receives one chunk of plays parsed in the browser.
export async function importChunk(rows: unknown): Promise<ImportChunkResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session ended. Log in again and retry the import." };
  if (tooFast(user.id)) return { error: "That's a lot of data very fast. Wait a minute, then import again." };
  try {
    return await saveImportedStreams(user.id, validateRows(rows));
  } catch (error) {
    if (error instanceof ImportLimitError) return { error: `${error.message}.` };
    throw error;
  }
}
