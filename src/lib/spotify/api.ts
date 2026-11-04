import { env, spotifyRedirectUri } from "../env";
import type { SpotifyImage, TokenResponse } from "./types";

const ACCOUNTS_URL = "https://accounts.spotify.com";
const API_URL = "https://api.spotify.com/v1";

export const SCOPES = [
  "user-read-recently-played",
  "user-top-read",
  "user-read-currently-playing",
];

export class SpotifyError extends Error {
  constructor(
    message: string,
    readonly status: number,
    // OAuth error code from the accounts service, e.g. "invalid_grant"
    readonly code?: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "SpotifyError";
  }
}

export function authorizeUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: env("SPOTIFY_CLIENT_ID"),
    scope: SCOPES.join(" "),
    redirect_uri: spotifyRedirectUri(),
    state,
  });
  return `${ACCOUNTS_URL}/authorize?${params}`;
}

async function requestToken(params: Record<string, string>): Promise<TokenResponse> {
  const credentials = `${env("SPOTIFY_CLIENT_ID")}:${env("SPOTIFY_CLIENT_SECRET")}`;
  const res = await fetch(`${ACCOUNTS_URL}/api/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(credentials).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail = body.error_description ? ` (${body.error_description})` : "";
    throw new SpotifyError(
      `Token request failed: ${body.error ?? res.status}${detail}`,
      res.status,
      body.error,
    );
  }
  return res.json();
}

export function exchangeCode(code: string): Promise<TokenResponse> {
  return requestToken({
    grant_type: "authorization_code",
    code,
    redirect_uri: spotifyRedirectUri(),
  });
}

export function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  return requestToken({ grant_type: "refresh_token", refresh_token: refreshToken });
}

// App-level token for catalog lookups (artists, tracks) that need no user
let appToken: { value: string; expiresAt: number } | null = null;

export async function getAppAccessToken(): Promise<string> {
  if (appToken && appToken.expiresAt > Date.now() + 60_000) return appToken.value;
  const tokens = await requestToken({ grant_type: "client_credentials" });
  appToken = { value: tokens.access_token, expiresAt: Date.now() + tokens.expires_in * 1000 };
  return appToken.value;
}

// Returns null for 204 No Content (e.g. nothing currently playing).
export async function spotifyGet<T>(path: string, accessToken: string): Promise<T | null> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 204) return null;
  if (res.status === 429) {
    const body = await res.json().catch(() => null);
    throw new SpotifyError(
      `Spotify rate limit hit (${body?.reason ?? "RATE_LIMITED"})`,
      429,
      body?.reason,
      Number(res.headers.get("retry-after") ?? 30),
    );
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new SpotifyError(body?.error?.message ?? `Spotify API returned ${res.status}`, res.status);
  }
  return res.json();
}

// Spotify lists images largest first; pick the smallest one that is still
// at least `minWidth` wide.
export function pickImage(images: SpotifyImage[] | undefined, minWidth = 300): string | null {
  if (!images?.length) return null;
  const bigEnough = images.filter((image) => (image.width ?? minWidth) >= minWidth);
  return (bigEnough.at(-1) ?? images[0]).url;
}
