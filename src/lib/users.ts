import { eq } from "drizzle-orm";
import { db } from "./db";
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
