import "server-only";
import { and, desc, eq, gt, ne, sql } from "drizzle-orm";
import { io } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { randomToken, sha256 } from "./crypto";
import { db } from "./db";
import { sessions, users } from "./db/schema";
import { appUrl } from "./env";
import { requestPreferences } from "./preferences";

const SESSION_COOKIE = "statslk_session";
// Holds the OAuth `state` between /api/auth/login and /api/auth/callback
export const OAUTH_STATE_COOKIE = "statslk_oauth_state";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// Stores a new session and returns the cookie to set on the response.
export async function createSession(userId: string, userAgent: string | null) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({ id: sha256(token), userId, expiresAt, userAgent: userAgent?.slice(0, 300) ?? null });
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: appUrl().startsWith("https://"),
    sameSite: "lax" as const,
    path: "/",
    expires: expiresAt,
  };
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, sha256(token)));
  store.delete(SESSION_COOKIE);
}

// Reads the session cookie, so callers must sit behind a <Suspense> boundary.
export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [row] = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    // now() in SQL: reading the clock in JS here would break prerendering
    .where(and(eq(sessions.id, sha256(token)), gt(sessions.expiresAt, sql`now()`)))
    .limit(1);
  if (row) requestPreferences().timezone = row.user.timezone;
  return row?.user ?? null;
});

// Hash of this request's session cookie, to tell "this device" apart
export async function currentSessionId(): Promise<string | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? sha256(token) : null;
}

export function listSessions(userId: string) {
  return db
    .select({ id: sessions.id, createdAt: sessions.createdAt, userAgent: sessions.userAgent })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), gt(sessions.expiresAt, sql`now()`)))
    .orderBy(desc(sessions.createdAt));
}

// Ends the user's sessions, except `keepId` when given
export async function endSessions(userId: string, keepId?: string): Promise<void> {
  await db
    .delete(sessions)
    .where(keepId ? and(eq(sessions.userId, userId), ne(sessions.id, keepId)) : eq(sessions.userId, userId));
}

// For logged-in pages. Also marks the render as request-time (io()), so
// pages can use the current time (date ranges, "3 minutes ago") after it.
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await io();
  return user;
}
