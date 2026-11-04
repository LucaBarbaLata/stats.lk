"use server";

import { eq, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { nowPlaying, users } from "@/lib/db/schema";
import { setHidden, type HiddenType } from "@/lib/hidden";
import { refreshNowPlaying } from "@/lib/now-playing";
import { destroySession, getCurrentUser } from "@/lib/session";
import {
  acceptFriendRequest,
  getNowPlaying,
  removeFriendship,
  sendFriendRequest,
  type NowPlayingEntry,
} from "@/lib/social";
import { syncUser } from "@/lib/sync";

const MIN_SYNC_GAP_MS = 30_000;
// The viewer's own now playing is fetched from Spotify when older than this
const OWN_NOW_PLAYING_MAX_AGE_MS = 10_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function requireViewer() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not logged in");
  return user;
}

function checkUserId(id: unknown): string {
  if (typeof id !== "string" || !UUID.test(id)) throw new Error("Invalid user id");
  return id;
}

export async function logout() {
  await destroySession();
  redirect("/");
}

// Called while the app is open (src/components/live-sync.tsx), so fresh
// plays show up without waiting for the worker. Returns how many plays this
// call stored and when the latest saved play was (epoch ms), so the page can
// also notice plays the worker saved.
export async function syncNow(): Promise<{ added: number; latestMs: number | null }> {
  const user = await getCurrentUser();
  if (!user) return { added: 0, latestMs: null };
  const due = !user.lastSyncedAt || Date.now() - user.lastSyncedAt.getTime() >= MIN_SYNC_GAP_MS;
  const added = due ? await syncUser(user.id).catch(() => 0) : 0;
  const [row] = await db.execute<{ latestMs: number | null }>(sql`
    select (extract(epoch from max(played_at)) * 1000)::float8 as "latestMs"
    from streams where user_id = ${user.id}::uuid`);
  return { added, latestMs: row?.latestMs ?? null };
}

// Polled by the live "now playing" cards. Others' entries come from the
// worker; the viewer's own is refreshed from Spotify so it feels instant.
export async function pollNowPlaying(userIds: unknown): Promise<NowPlayingEntry[]> {
  const viewer = await requireViewer();
  if (!Array.isArray(userIds) || userIds.length > 50) throw new Error("Invalid user list");
  const ids = userIds.map(checkUserId);

  if (ids.includes(viewer.id)) {
    const [own] = await db
      .select({ fetchedAt: nowPlaying.fetchedAt })
      .from(nowPlaying)
      .where(eq(nowPlaying.userId, viewer.id));
    if (!own || Date.now() - own.fetchedAt.getTime() > OWN_NOW_PLAYING_MAX_AGE_MS) {
      await refreshNowPlaying(viewer.id).catch(() => {});
    }
  }
  return getNowPlaying(viewer.id, ids);
}

export async function addFriend(otherId: string) {
  const viewer = await requireViewer();
  await sendFriendRequest(viewer.id, checkUserId(otherId));
  refresh();
}

export async function acceptFriend(otherId: string) {
  const viewer = await requireViewer();
  await acceptFriendRequest(viewer.id, checkUserId(otherId));
  refresh();
}

// Declines a request, cancels one, or unfriends
export async function removeFriend(otherId: string) {
  const viewer = await requireViewer();
  await removeFriendship(viewer.id, checkUserId(otherId));
  refresh();
}

const SPOTIFY_ID = /^[0-9A-Za-z]{22}$/;

export async function setItemHidden(type: HiddenType, itemId: string, hidden: boolean) {
  const viewer = await requireViewer();
  if ((type !== "artist" && type !== "track") || !SPOTIFY_ID.test(itemId)) throw new Error("Invalid item");
  await setHidden(viewer.id, type, itemId, hidden);
  refresh();
}

// Deletes the user and, through cascades, every play, token, session,
// friendship and setting. Shared catalog data (tracks, artists) stays.
export async function deleteAccount(formData: FormData) {
  const viewer = await requireViewer();
  if (String(formData.get("confirm")).trim().toLowerCase() !== "delete") {
    redirect("/settings/data?error=confirm#delete-account");
  }
  await db.delete(users).where(eq(users.id, viewer.id));
  await destroySession();
  redirect("/login?deleted=1");
}

