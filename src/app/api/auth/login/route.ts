import { NextResponse } from "next/server";
import { randomToken } from "@/lib/crypto";
import { appUrl } from "@/lib/env";
import { OAUTH_STATE_COOKIE } from "@/lib/session";
import { authorizeUrl } from "@/lib/spotify/api";

export async function GET() {
  const state = randomToken(16);
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
