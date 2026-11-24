import { eq } from "drizzle-orm";
import { db } from "./db";
import { isUniqueViolation } from "./db/errors";
import { users } from "./db/schema";
import { pickImage } from "./spotify/api";
import { saveTokens } from "./spotify/tokens";
import type { SpotifyUser, TokenResponse } from "./spotify/types";
import { generateUsername } from "./usernames";

// Creates the user on first login, refreshes profile and tokens afterwards.
// The username is only picked once; users can change it in settings. So can
// the display name, which logins then leave alone.
export async function upsertSpotifyUser(
  profile: SpotifyUser,
  tokens: TokenResponse,
): Promise<string> {
  const displayName = profile.display_name ?? profile.id;
  const avatarUrl = pickImage(profile.images);

  const [existing] = await db
    .select({ id: users.id, customDisplayName: users.customDisplayName })
    .from(users)
    .where(eq(users.spotifyId, profile.id));
  let userId: string;
  if (existing) {
    await db
      .update(users)
      .set(existing.customDisplayName ? { avatarUrl } : { displayName, avatarUrl })
      .where(eq(users.id, existing.id));
    userId = existing.id;
  } else {
    const [created] = await db
      .insert(users)
      .values({
        spotifyId: profile.id,
        username: await generateUsername(displayName, profile.id),
        displayName,
        avatarUrl,
      })
      .returning({ id: users.id });
    userId = created.id;
  }
  await saveTokens(userId, tokens);
  return userId;
}

export type LinkResult = "linked" | "taken" | "other";

// Ties a Spotify account to an existing account (Settings → Connections).
// "taken": that Spotify account already has a stats.lk account of its own,
// and accounts are never merged. "other": this account is tied to another
// Spotify account. Reconnecting the same one just saves new tokens.
export async function linkSpotifyAccount(
  userId: string,
  profile: SpotifyUser,
  tokens: TokenResponse,
): Promise<LinkResult> {
  const [owner] = await db.select({ id: users.id }).from(users).where(eq(users.spotifyId, profile.id));
  if (owner && owner.id !== userId) return "taken";
  const [user] = await db.select({ spotifyId: users.spotifyId }).from(users).where(eq(users.id, userId));
  if (!user) throw new Error("No such user");
  if (user.spotifyId && user.spotifyId !== profile.id) return "other";

  try {
    await db
      .update(users)
      .set({
        spotifyId: profile.id,
        avatarUrl: pickImage(profile.images),
        // A first link keeps the name picked here (Spotify's is often a real
        // name), and later Spotify logins leave it alone too
        ...(user.spotifyId ? {} : { customDisplayName: true }),
        syncError: null,
      })
      .where(eq(users.id, userId));
  } catch (error) {
    // Unique violation: tied to another account a moment ago
    if (isUniqueViolation(error)) return "taken";
    throw error;
  }
  await saveTokens(userId, tokens);
  return "linked";
}
