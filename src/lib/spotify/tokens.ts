import { eq } from "drizzle-orm";
import { decrypt, encrypt } from "../crypto";
import { db } from "../db";
import { spotifyTokens } from "../db/schema";
import { refreshAccessToken, SpotifyError } from "./api";
import type { TokenResponse } from "./types";

const REFRESH_MARGIN_MS = 60_000;

export async function saveTokens(userId: string, tokens: TokenResponse): Promise<void> {
  if (!tokens.refresh_token) throw new Error("Spotify did not return a refresh token");
  const values = {
    accessToken: encrypt(tokens.access_token),
    refreshToken: encrypt(tokens.refresh_token),
    expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    scope: tokens.scope,
    revokedAt: null,
  };
  await db
    .insert(spotifyTokens)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: spotifyTokens.userId, set: values });
}

// Returns a valid access token for the user, refreshing it when needed.
export async function getAccessToken(userId: string): Promise<string> {
  const [row] = await db.select().from(spotifyTokens).where(eq(spotifyTokens.userId, userId));
  if (!row || row.revokedAt) throw new SpotifyError("Spotify access was revoked", 401, "revoked");
  if (row.expiresAt.getTime() > Date.now() + REFRESH_MARGIN_MS) return decrypt(row.accessToken);

  try {
    // The web app and the worker may both try to refresh at once. Lock the
    // row and re-check, so only one of them talks to Spotify.
    return await db.transaction(async (tx) => {
      const [locked] = await tx
        .select()
        .from(spotifyTokens)
        .where(eq(spotifyTokens.userId, userId))
        .for("update");
      if (locked.expiresAt.getTime() > Date.now() + REFRESH_MARGIN_MS) {
        return decrypt(locked.accessToken);
      }

      const tokens = await refreshAccessToken(decrypt(locked.refreshToken));
      await tx
        .update(spotifyTokens)
        .set({
          accessToken: encrypt(tokens.access_token),
          // Spotify only sometimes rotates the refresh token
          ...(tokens.refresh_token && { refreshToken: encrypt(tokens.refresh_token) }),
          expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        })
        .where(eq(spotifyTokens.userId, userId));
      return tokens.access_token;
    });
  } catch (error) {
    // Outside the transaction, which has been rolled back by now
    if (error instanceof SpotifyError && error.code === "invalid_grant") {
      await db
        .update(spotifyTokens)
        .set({ revokedAt: new Date() })
        .where(eq(spotifyTokens.userId, userId));
    }
    throw error;
  }
}
