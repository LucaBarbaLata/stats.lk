"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { spotifyTokens, streams, users } from "@/lib/db/schema";
import { refreshNowPlaying } from "@/lib/now-playing";
import { isValidTimezone, SORTS, WEEK_STARTS } from "@/lib/preferences";
import { PRESETS } from "@/lib/ranges";
import { currentSessionId, destroySession, endSessions, getCurrentUser } from "@/lib/session";
import { syncUser } from "@/lib/sync";
import { BIO_MAX, DISPLAY_NAME_MAX } from "@/lib/profile";
import { changeUsername, isUsernameTaken, normalizeUsername, USERNAME_PATTERN } from "@/lib/usernames";

// Settings forms show the result next to their button (see SettingsForm)
export type FormState = { ok: boolean; message: string } | null;

async function viewer() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function saveProfile(_: FormState, formData: FormData): Promise<FormState> {
  const user = await viewer();
  const displayName = String(formData.get("displayName") ?? "").trim().replace(/\s+/g, " ");
  const bio = String(formData.get("bio") ?? "").trim().replace(/\n{3,}/g, "\n\n");
  if (!displayName) return { ok: false, message: "Enter a display name." };
  if (displayName.length > DISPLAY_NAME_MAX) return { ok: false, message: `Keep the name under ${DISPLAY_NAME_MAX + 1} characters.` };
  if (bio.length > BIO_MAX) return { ok: false, message: `Keep the bio under ${BIO_MAX + 1} characters.` };

  const username = normalizeUsername(String(formData.get("username") ?? ""));
  if (username !== user.username) {
    const result = await changeUsername(user.id, username);
    if (!result.ok) return { ok: false, message: result.error };
  }
  await db
    .update(users)
    .set({
      displayName,
      // Once changed here, logging in no longer copies the name from Spotify
      customDisplayName: user.customDisplayName || displayName !== user.displayName,
      bio: bio || null,
    })
    .where(eq(users.id, user.id));
  refresh();
  return { ok: true, message: "Saved" };
}

export type UsernameCheck = "current" | "available" | "taken" | "invalid";

// Called while typing in the profile link field
export async function checkUsername(input: unknown): Promise<UsernameCheck> {
  const user = await viewer();
  if (typeof input !== "string") return "invalid";
  const username = normalizeUsername(input);
  if (username === user.username) return "current";
  if (!USERNAME_PATTERN.test(username)) return "invalid";
  return (await isUsernameTaken(username, user.id)) ? "taken" : "available";
}

const VISIBILITIES = ["private", "friends", "everyone", "public"] as const;

export async function savePrivacy(_: FormState, formData: FormData): Promise<FormState> {
  const user = await viewer();
  const visibility = VISIBILITIES.find((value) => value === formData.get("visibility"));
  if (!visibility) return { ok: false, message: "Pick who can see your profile." };
  await db
    .update(users)
    .set({ visibility, showNowPlaying: formData.get("showNowPlaying") === "on" })
    .where(eq(users.id, user.id));
  refresh();
  return { ok: true, message: "Saved" };
}

export async function savePreferences(_: FormState, formData: FormData): Promise<FormState> {
  const user = await viewer();
  const timezone = String(formData.get("timezone") ?? "");
  const weekStart = Number(formData.get("weekStart"));
  const defaultRange = String(formData.get("defaultRange"));
  const defaultSort = String(formData.get("defaultSort"));
  if (timezone && !isValidTimezone(timezone)) return { ok: false, message: "That time zone isn't recognized." };
  if (
    !WEEK_STARTS.some((option) => option.value === weekStart) ||
    !PRESETS.some((preset) => preset.key === defaultRange) ||
    !SORTS.some((option) => option.value === defaultSort)
  ) {
    return { ok: false, message: "Some choices weren't valid. Reload the page and try again." };
  }
  await db
    .update(users)
    .set({ timezone: timezone || null, weekStart, defaultRange, defaultSort })
    .where(eq(users.id, user.id));
  refresh();
  return { ok: true, message: "Saved" };
}

export async function syncNowFromSettings(): Promise<FormState> {
  const user = await viewer();
  const added = await syncUser(user.id);
  await refreshNowPlaying(user.id).catch(() => {});
  refresh();
  return { ok: true, message: added ? `Synced: ${added} new ${added === 1 ? "play" : "plays"}` : "Synced: nothing new" };
}

// Removes the Spotify tokens and every session. Logging in again reconnects.
export async function disconnectSpotify() {
  const user = await viewer();
  await db.delete(spotifyTokens).where(eq(spotifyTokens.userId, user.id));
  await endSessions(user.id);
  await destroySession();
  redirect("/login");
}

export async function deleteImportedHistory(_: FormState, formData: FormData): Promise<FormState> {
  const user = await viewer();
  if (formData.get("confirm") !== "on") return { ok: false, message: "Tick the box to confirm." };
  const deleted = await db
    .delete(streams)
    .where(and(eq(streams.userId, user.id), eq(streams.source, "import")))
    .returning({ id: streams.id });
  refresh();
  return { ok: true, message: `Deleted ${deleted.length.toLocaleString("en-US")} imported plays` };
}

export async function logOutOtherDevices(): Promise<FormState> {
  const user = await viewer();
  const current = await currentSessionId();
  await endSessions(user.id, current ?? undefined);
  refresh();
  return { ok: true, message: "Logged out on your other devices" };
}

export async function logOutEverywhere() {
  const user = await viewer();
  await endSessions(user.id);
  await destroySession();
  redirect("/login");
}
