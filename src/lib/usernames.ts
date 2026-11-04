import { and, eq, ne } from "drizzle-orm";
import { db } from "./db";
import { users } from "./db/schema";

// Usernames are what profile links use: /u/<username>. Lowercase letters,
// digits, "_" and "."; 3 to 24 characters; starting with a letter or digit.
export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9_.]{2,23}$/;

export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase();
}

// Turns a display name into a username candidate ("Luca R." -> "lucar.")
function slugify(displayName: string): string {
  return displayName
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_.]+/g, "")
    .replace(/^[_.]+/, "")
    .slice(0, 24);
}

export async function isUsernameTaken(username: string, exceptUserId?: string): Promise<boolean> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(exceptUserId ? and(eq(users.username, username), ne(users.id, exceptUserId)) : eq(users.username, username));
  return Boolean(row);
}

// A free username based on the display name, with a number added if needed
export async function generateUsername(displayName: string, fallback: string): Promise<string> {
  const slug = slugify(displayName);
  const base = slug.length >= 3 ? slug : slugify(fallback).slice(0, 16) || "listener";
  for (let attempt = 1; attempt < 1000; attempt++) {
    const suffix = attempt === 1 ? "" : String(attempt);
    const candidate = `${base.slice(0, 24 - suffix.length)}${suffix}`;
    if (USERNAME_PATTERN.test(candidate) && !(await isUsernameTaken(candidate))) return candidate;
  }
  throw new Error("Could not find a free username");
}

export type UsernameResult = { ok: true } | { ok: false; error: string };

export async function changeUsername(userId: string, input: string): Promise<UsernameResult> {
  const username = normalizeUsername(input);
  if (!USERNAME_PATTERN.test(username)) {
    return {
      ok: false,
      error: "Use 3 to 24 lowercase letters, digits, dots or underscores, starting with a letter or digit.",
    };
  }
  if (await isUsernameTaken(username, userId)) return { ok: false, error: "That link is taken. Try another." };
  await db.update(users).set({ username }).where(eq(users.id, userId));
  return { ok: true };
}
