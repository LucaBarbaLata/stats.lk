import { NextResponse, type NextRequest } from "next/server";
import { appUrl } from "@/lib/env";
import { createSession, OAUTH_STATE_COOKIE } from "@/lib/session";
import { exchangeCode, spotifyGet, SpotifyError } from "@/lib/spotify/api";
import type { SpotifyUser } from "@/lib/spotify/types";
import { syncUser } from "@/lib/sync";
import { upsertSpotifyUser } from "@/lib/users";

function redirectTo(path: string) {
  // Build from APP_URL: behind a reverse proxy request.url is the internal address
  const response = NextResponse.redirect(new URL(path, appUrl()));
  response.cookies.delete({ name: OAUTH_STATE_COOKIE, path: "/api/auth" });
  return response;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state");
  if (params.get("error")) return redirectTo("/login?error=denied");
  if (!code || !state || state !== request.cookies.get(OAUTH_STATE_COOKIE)?.value) {
    return redirectTo("/login?error=state");
  }

  let userId: string;
  try {
    const tokens = await exchangeCode(code);
    const profile = await spotifyGet<SpotifyUser>("/me", tokens.access_token);
    if (!profile) throw new Error("Empty Spotify profile");
    userId = await upsertSpotifyUser(profile, tokens);
  } catch (error) {
    // Development Mode apps answer 403 for accounts missing from the allowlist
    if (error instanceof SpotifyError && error.status === 403) {
      return redirectTo("/login?error=not_allowlisted");
    }
    console.error("Spotify login failed:", error);
    return redirectTo("/login?error=login");
  }

  const sessionCookie = await createSession(userId, request.headers.get("user-agent"));
  // Fetch the last 50 plays right away so the dashboard isn't empty
  await syncUser(userId).catch(() => {});
  const response = redirectTo("/dashboard");
  response.cookies.set(sessionCookie);
  return response;
}
