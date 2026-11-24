import { NextResponse, type NextRequest } from "next/server";
import { randomToken } from "@/lib/crypto";
import { appUrl } from "@/lib/env";
import { CONNECT_STATE_PREFIX, OAUTH_STATE_COOKIE } from "@/lib/session";
import { authorizeUrl } from "@/lib/spotify/api";

// `?connect=1` (Settings → Connections) ties Spotify to the account that is
// logged in, instead of logging in with Spotify. The state remembers which.
export async function GET(request: NextRequest) {
  const connect = request.nextUrl.searchParams.get("connect") === "1";
  const state = `${connect ? CONNECT_STATE_PREFIX : ""}${randomToken(16)}`;
  const response = NextResponse.redirect(authorizeUrl(state));
  response.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: appUrl().startsWith("https://"),
    sameSite: "lax",
    path: "/api/auth",
    maxAge: 600,
  });
  return response;
}
