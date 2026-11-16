import { NextResponse, type NextRequest } from "next/server";
import { appUrl } from "@/lib/env";
import { CONNECT_STATE_PREFIX, createSession, getCurrentUser, OAUTH_STATE_COOKIE } from "@/lib/session";
import { exchangeCode, spotifyGet, SpotifyError } from "@/lib/spotify/api";
import type { SpotifyUser, TokenResponse } from "@/lib/spotify/types";
import { syncUser } from "@/lib/sync";
import { linkSpotifyAccount, upsertSpotifyUser } from "@/lib/users";

function redirectTo(path: string) {
  // Build from APP_URL: behind a reverse proxy request.url is the internal address
  const response = NextResponse.redirect(new URL(path, appUrl()));
  response.cookies.delete({ name: OAUTH_STATE_COOKIE, path: "/api/auth" });
  return response;
}

async function spotifyAccount(code: string): Promise<{ profile: SpotifyUser; tokens: TokenResponse }> {
  const tokens = await exchangeCode(code);
  const profile = await spotifyGet<SpotifyUser>("/me", tokens.access_token);
  if (!profile) throw new Error("Empty Spotify profile");
  return { profile, tokens };
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const connecting = state?.startsWith(CONNECT_STATE_PREFIX) ?? false;
  const failed = (error: string) =>
    redirectTo(connecting ? `/settings/connections?error=${error}` : `/login?error=${error}`);

  if (params.get("error")) return failed("denied");
  if (!code || !state || state !== request.cookies.get(OAUTH_STATE_COOKIE)?.value) return failed("state");
  if (connecting) return connect(code, failed);

  let userId: string;
  try {
    const { profile, tokens } = await spotifyAccount(code);
    userId = await upsertSpotifyUser(profile, tokens);
  } catch (error) {
    // Development Mode apps answer 403 for accounts missing from the allowlist
    if (error instanceof SpotifyError && error.status === 403) return failed("not_allowlisted");
    console.error("Spotify login failed:", error);
    return failed("login");
  }

  const sessionCookie = await createSession(userId, request.headers.get("user-agent"));
  // Fetch the last 50 plays right away so the dashboard isn't empty
  await syncUser(userId).catch(() => {});
  const response = redirectTo("/dashboard");
  response.cookies.set(sessionCookie);
  return response;
}

// Settings → Connections: ties Spotify to the account that is logged in
async function connect(code: string, failed: (error: string) => NextResponse) {
  const user = await getCurrentUser();
  if (!user) return redirectTo("/login");
  try {
    const { profile, tokens } = await spotifyAccount(code);
    const result = await linkSpotifyAccount(user.id, profile, tokens);
    if (result !== "linked") return failed(result);
  } catch (error) {
    if (error instanceof SpotifyError && error.status === 403) return failed("not_allowlisted");
    console.error("Connecting Spotify failed:", error);
    return failed("login");
  }
  await syncUser(user.id).catch(() => {});
  return redirectTo("/settings/connections?connected=1");
}
