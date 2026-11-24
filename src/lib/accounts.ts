import { and, count, desc, eq, isNotNull, isNull, lt, ne, sql } from "drizzle-orm";
import { EMAIL_MAX, passwordProblem } from "./account-rules";
import { randomToken, sha256 } from "./crypto";
import { db } from "./db";
import { isUniqueViolation } from "./db/errors";
import { emailTokens, sessions, users, type EmailTokenPurpose } from "./db/schema";
import { sendEmail } from "./email";
import { appUrl, contactEmail } from "./env";
import { dummyPasswordHash, hashPassword, verifyPassword } from "./passwords";
import { withinLimit } from "./rate-limit";
import { isUsernameTaken, normalizeUsername, USERNAME_PATTERN } from "./usernames";

// Accounts made with an email and a password (phase 8 in PLAN.md). Spotify
// logins live in src/lib/users.ts. These functions take the visitor's IP for
// rate limits and leave cookies to the caller (src/app/auth-actions.ts).

const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const VERIFY_LINK_TTL_MS = 24 * HOUR;
const RESET_LINK_TTL_MS = HOUR;
// Unconfirmed sign-ups are deleted after this, so they don't hold places
const UNCONFIRMED_TTL_MS = 24 * HOUR;

const TOO_MANY = "Too many tries. Wait a few minutes and try again.";
const NOT_SENT = "We couldn't send the email right now. Try again in a few minutes.";

// Sends, and turns a failure (SMTP down, wrong settings) into a message for the form
async function trySending(send: () => Promise<void>): Promise<boolean> {
  try {
    await send();
    return true;
  } catch (error) {
    console.error("Sending email failed:", error instanceof Error ? error.message : error);
    return false;
  }
}
const USERNAME_RULES = "Use 3 to 24 lowercase letters, digits, dots or underscores, starting with a letter or digit.";

export type Failure = { ok: false; error: string };
export type Outcome = { ok: true } | Failure;

export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

function isEmail(email: string): boolean {
  return email.length <= EMAIL_MAX && EMAIL_PATTERN.test(email);
}

// How many accounts stats.lk takes. Spotify logins of invited people get in
// anyway: Spotify itself limits those to 5.
export function maxAccounts(): number {
  const max = Number(process.env.MAX_ACCOUNTS);
  return Number.isInteger(max) && max > 0 ? max : 50;
}

export async function signupsOpen(): Promise<boolean> {
  return (await emailAccess()).signups;
}

// Whether people can sign up, and whether logging in with an email makes sense:
// at the account limit it still does for those who have one, but on a server
// where nobody does, the form would be of no use.
export async function emailAccess(): Promise<{ signups: boolean; login: boolean }> {
  const [row] = await db.select({ total: count(), withEmail: count(users.email) }).from(users);
  const signups = row.total < maxAccounts();
  return { signups, login: signups || row.withEmail > 0 };
}

async function findByEmail(email: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email));
  return user ?? null;
}

async function issueLink(userId: string, purpose: EmailTokenPurpose, email: string, ttlMs: number): Promise<string> {
  const token = randomToken();
  await db.insert(emailTokens).values({ id: sha256(token), userId, purpose, email, expiresAt: new Date(Date.now() + ttlMs) });
  const path = purpose === "verify" ? "/verify" : "/reset-password";
  return `${appUrl()}${path}?token=${encodeURIComponent(token)}`;
}

// The link's row if it's still valid, removed so it can't be used again
async function consumeLink(token: string, purpose: EmailTokenPurpose) {
  if (!token) return null;
  const [row] = await db
    .delete(emailTokens)
    .where(and(eq(emailTokens.id, sha256(token)), eq(emailTokens.purpose, purpose)))
    .returning();
  return row && row.expiresAt.getTime() > Date.now() ? row : null;
}

// Whether a link still works, without using it up (to show the right form)
export async function linkWorks(token: string, purpose: EmailTokenPurpose): Promise<boolean> {
  if (!token) return false;
  const [row] = await db
    .select({ expiresAt: emailTokens.expiresAt })
    .from(emailTokens)
    .where(and(eq(emailTokens.id, sha256(token)), eq(emailTokens.purpose, purpose)));
  return Boolean(row && row.expiresAt.getTime() > Date.now());
}

const SIGNATURE = "stats.lk";

async function sendVerifyLink(userId: string, email: string): Promise<void> {
  const link = await issueLink(userId, "verify", email, VERIFY_LINK_TTL_MS);
  await sendEmail({
    to: email,
    subject: "Confirm your email for stats.lk",
    text: [
      "Hi,",
      "",
      "Confirm your email to finish creating your stats.lk account:",
      link,
      "",
      "The link works for 24 hours. If you didn't sign up, ignore this email and the account will be deleted.",
      "",
      SIGNATURE,
    ].join("\n"),
  });
}

// For an address added or changed in Settings: confirming it moves the login there
async function sendNewAddressLink(userId: string, email: string): Promise<void> {
  const link = await issueLink(userId, "verify", email, VERIFY_LINK_TTL_MS);
  await sendEmail({
    to: email,
    subject: "Confirm your new email for stats.lk",
    text: [
      "Hi,",
      "",
      "Confirm this address to log in to stats.lk with it:",
      link,
      "",
      "The link works for 24 hours. If you didn't ask for this, ignore this email and nothing changes.",
      "",
      SIGNATURE,
    ].join("\n"),
  });
}

// To the old address, once the new one is confirmed
async function sendEmailChanged(oldEmail: string, newEmail: string): Promise<void> {
  const contact = contactEmail();
  await sendEmail({
    to: oldEmail,
    subject: "Your stats.lk email was changed",
    text: [
      "Hi,",
      "",
      `Your stats.lk account now logs in with ${newEmail} instead of this address.`,
      "",
      contact
        ? `If you didn't change it, write to ${contact} right away.`
        : "If you didn't change it, reply to this email right away.",
      "",
      SIGNATURE,
    ].join("\n"),
  });
}

async function sendAlreadyRegistered(email: string, attempt = "sign up to stats.lk with this email"): Promise<void> {
  await sendEmail({
    to: email,
    subject: "You already have a stats.lk account",
    text: [
      "Hi,",
      "",
      `Someone, hopefully you, tried to ${attempt}. It already has an account, so nothing changed.`,
      "",
      `Log in: ${appUrl()}/login`,
      `Forgot your password? ${appUrl()}/reset-password`,
      "",
      "If it wasn't you, you can ignore this email.",
      "",
      SIGNATURE,
    ].join("\n"),
  });
}

async function sendResetLink(userId: string, email: string): Promise<void> {
  const link = await issueLink(userId, "reset", email, RESET_LINK_TTL_MS);
  await sendEmail({
    to: email,
    subject: "Reset your stats.lk password",
    text: [
      "Hi,",
      "",
      "Choose a new password for your stats.lk account here:",
      link,
      "",
      "The link works for 1 hour. If you didn't ask for it, ignore this email and your password stays the same.",
      "",
      SIGNATURE,
    ].join("\n"),
  });
}

// Creates an unconfirmed account and emails the confirmation link. When the
// email already has an account, the answer looks the same and the email goes
// to its owner instead, so the form doesn't reveal who has an account. Signing
// up again before confirming replaces the first try.
export async function signUp(
  input: { email: string; password: string; username: string },
  ip: string,
): Promise<Outcome> {
  const email = normalizeEmail(input.email);
  const username = normalizeUsername(input.username);
  if (!isEmail(email)) return { ok: false, error: "Enter a valid email address." };
  if (!USERNAME_PATTERN.test(username)) return { ok: false, error: USERNAME_RULES };
  const problem = passwordProblem(input.password, email);
  if (problem) return { ok: false, error: problem };
  if (!withinLimit(`signup:${ip}`, 5, HOUR)) return { ok: false, error: TOO_MANY };
  if (await isUsernameTaken(username)) return { ok: false, error: "That username is taken. Try another." };

  // Hashed even when it isn't needed, so the time it takes doesn't tell either
  const passwordHash = await hashPassword(input.password);
  const existing = await findByEmail(email);
  if (existing) {
    if (withinLimit(`email:${email}`, 3, HOUR)) {
      if (!existing.emailVerifiedAt) {
        try {
          await db
            .update(users)
            .set({ passwordHash, username, displayName: username })
            .where(and(eq(users.id, existing.id), isNull(users.emailVerifiedAt)));
        } catch (error) {
          if (isUniqueViolation(error)) return { ok: false, error: "That username is taken. Try another." };
          throw error;
        }
      }
      const sent = await trySending(() =>
        existing.emailVerifiedAt ? sendAlreadyRegistered(email) : sendVerifyLink(existing.id, email),
      );
      if (!sent) return { ok: false, error: NOT_SENT };
    }
    return { ok: true };
  }

  const created = await db.transaction(async (tx): Promise<{ id: string } | "closed" | "taken"> => {
    // One sign-up at a time, so two at once can't both take the last place
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('statslk_signup'))`);
    const [{ total }] = await tx.select({ total: count() }).from(users);
    if (total >= maxAccounts()) return "closed";
    const inserted = await tx
      .insert(users)
      .values({ email, passwordHash, username, displayName: username })
      .onConflictDoNothing()
      .returning({ id: users.id });
    // A conflict: someone took the username (or the email) a moment ago
    return inserted.length ? inserted[0] : "taken";
  });
  if (created === "closed") return { ok: false, error: "Sign-ups are closed for now. Try again later." };
  if (created === "taken") return { ok: false, error: "That username is taken. Try another." };

  withinLimit(`email:${email}`, 3, HOUR);
  if (!(await trySending(() => sendVerifyLink(created.id, email)))) {
    // Nobody could confirm it, so it would only hold the place and the username
    await db.delete(users).where(eq(users.id, created.id));
    return { ok: false, error: NOT_SENT };
  }
  return { ok: true };
}

// For "send the link again" after signing up or a refused login
export async function resendVerification(rawEmail: string, ip: string): Promise<Outcome> {
  const email = normalizeEmail(rawEmail);
  if (!withinLimit(`resend:${ip}`, 10, HOUR) || !withinLimit(`email:${email}`, 3, HOUR)) {
    return { ok: false, error: TOO_MANY };
  }
  const user = await findByEmail(email);
  if (user && !user.emailVerifiedAt && !(await trySending(() => sendVerifyLink(user.id, email)))) {
    return { ok: false, error: NOT_SENT };
  }
  return { ok: true };
}

export type Verified = { userId: string; changed: boolean } | "taken" | "password" | "limited" | null;

// Confirms the email of the link and returns the account to log in to.
// A link to another address than the account's comes from Settings and
// moves the login there (`changed`); "taken" if another account got that
// address in the meantime.
//
// Takes the account's password too. Anyone can sign up with someone else's
// address, and its owner opening the link would otherwise confirm an account
// whose password the other person knows. The owner can always reset it: that
// link confirms the address as well.
export async function verifyEmail(token: string, password: string): Promise<Verified> {
  if (!(await linkWorks(token, "verify"))) return null;
  const [owner] = await db
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(emailTokens)
    .innerJoin(users, eq(users.id, emailTokens.userId))
    .where(eq(emailTokens.id, sha256(token)));
  if (!owner) return null;
  if (!withinLimit(`verify:${owner.id}`, 10, 15 * MINUTE)) return "limited";
  if (!owner.passwordHash || !(await verifyPassword(password, owner.passwordHash))) return "password";

  const link = await consumeLink(token, "verify");
  if (!link) return null;
  const [user] = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.id, link.userId));
  if (!user) return null;
  if (user.email === link.email) {
    await db
      .update(users)
      .set({ emailVerifiedAt: sql`coalesce(${users.emailVerifiedAt}, now())` })
      .where(eq(users.id, user.id));
    return { userId: user.id, changed: false };
  }

  if (await findByEmail(link.email)) return "taken";
  try {
    await db.update(users).set({ email: link.email, emailVerifiedAt: new Date() }).where(eq(users.id, user.id));
  } catch (error) {
    // Unique violation: taken a moment ago
    if (isUniqueViolation(error)) return "taken";
    throw error;
  }
  // Links to the old address (resets) or to other new ones stop working
  await db.delete(emailTokens).where(eq(emailTokens.userId, user.id));
  if (user.email) {
    const oldEmail = user.email;
    await trySending(() => sendEmailChanged(oldEmail, link.email));
  }
  return { userId: user.id, changed: true };
}

// Settings → Login (src/app/(app)/settings/login). Accounts made with Spotify
// add an email and a password there; accounts that have them change them.

// The address a Settings link went to and nobody confirmed yet, if any
export async function pendingEmail(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ email: emailTokens.email })
    .from(emailTokens)
    .innerJoin(users, eq(users.id, emailTokens.userId))
    .where(
      and(
        eq(emailTokens.userId, userId),
        eq(emailTokens.purpose, "verify"),
        sql`${emailTokens.email} is distinct from ${users.email}`,
        sql`${emailTokens.expiresAt} > now()`,
      ),
    )
    .orderBy(desc(emailTokens.createdAt))
    .limit(1);
  return row?.email ?? null;
}

// Sends the link that moves the login to `email`. Only the newest such link
// works. An address with an account of its own gets a note instead, and the
// answer looks the same, as on sign-up.
async function sendAddressLink(userId: string, email: string): Promise<Outcome> {
  if (!withinLimit(`email:${email}`, 3, HOUR) || !withinLimit(`address:${userId}`, 5, HOUR)) {
    return { ok: false, error: TOO_MANY };
  }
  const owner = await findByEmail(email);
  if (owner?.id === userId) return { ok: false, error: "That's already your email." };
  if (owner) {
    const sent = await trySending(() => sendAlreadyRegistered(email, "add this email to another stats.lk account"));
    return sent ? { ok: true } : { ok: false, error: NOT_SENT };
  }
  await db
    .delete(emailTokens)
    .where(
      and(
        eq(emailTokens.userId, userId),
        eq(emailTokens.purpose, "verify"),
        sql`${emailTokens.email} is distinct from (select ${users.email} from ${users} where ${users.id} = ${userId})`,
      ),
    );
  return (await trySending(() => sendNewAddressLink(userId, email))) ? { ok: true } : { ok: false, error: NOT_SENT };
}

// For an account without an email (made with Spotify). The password is saved
// now and works once the email is confirmed.
export async function addLogin(userId: string, input: { email: string; password: string }): Promise<Outcome> {
  const email = normalizeEmail(input.email);
  if (!isEmail(email)) return { ok: false, error: "Enter a valid email address." };
  const problem = passwordProblem(input.password, email);
  if (problem) return { ok: false, error: problem };
  const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId));
  if (!user) return { ok: false, error: "Log in again and retry." };
  if (user.email) return { ok: false, error: "Your account already has an email. Reload the page." };

  const outcome = await sendAddressLink(userId, email);
  if (outcome.ok) {
    await db.update(users).set({ passwordHash: await hashPassword(input.password) }).where(eq(users.id, userId));
  }
  return outcome;
}

// Checks the current password before a change; limited like logins
async function checkPassword(userId: string, password: string): Promise<Outcome & { email?: string }> {
  if (!withinLimit(`password:${userId}`, 10, 15 * MINUTE)) return { ok: false, error: TOO_MANY };
  const [user] = await db.select({ email: users.email, passwordHash: users.passwordHash }).from(users).where(eq(users.id, userId));
  if (!user?.passwordHash || !user.email) return { ok: false, error: "Your account has no password yet." };
  if (!(await verifyPassword(password, user.passwordHash))) return { ok: false, error: "Your current password is wrong." };
  return { ok: true, email: user.email };
}

// The login stays on the old address until the new one is confirmed
export async function changeEmail(userId: string, input: { email: string; password: string }): Promise<Outcome> {
  const email = normalizeEmail(input.email);
  if (!isEmail(email)) return { ok: false, error: "Enter a valid email address." };
  const check = await checkPassword(userId, input.password);
  if (!check.ok) return check;
  if (check.email === email) return { ok: false, error: "That's already your email." };
  return sendAddressLink(userId, email);
}

// Logs out every other device, as a reset does
export async function changePassword(
  userId: string,
  input: { current: string; password: string },
  keepSessionId: string | null,
): Promise<Outcome> {
  const check = await checkPassword(userId, input.current);
  if (!check.ok) return check;
  const problem = passwordProblem(input.password, check.email ?? null);
  if (problem) return { ok: false, error: problem };
  if (input.password === input.current) return { ok: false, error: "That's your current password. Pick a new one." };
  await db.update(users).set({ passwordHash: await hashPassword(input.password) }).where(eq(users.id, userId));
  await db
    .delete(sessions)
    .where(and(eq(sessions.userId, userId), keepSessionId ? ne(sessions.id, keepSessionId) : undefined));
  await db.delete(emailTokens).where(and(eq(emailTokens.userId, userId), eq(emailTokens.purpose, "reset")));
  return { ok: true };
}

export async function logIn(
  rawEmail: string,
  password: string,
  ip: string,
): Promise<{ ok: true; userId: string } | (Failure & { unconfirmed?: boolean })> {
  const email = normalizeEmail(rawEmail);
  if (!withinLimit(`login:${ip}`, 20, 15 * MINUTE) || !withinLimit(`login:${email}`, 10, 15 * MINUTE)) {
    return { ok: false, error: TOO_MANY };
  }
  const user = isEmail(email) ? await findByEmail(email) : null;
  const matches = await verifyPassword(password, user?.passwordHash ?? (await dummyPasswordHash()));
  if (!user?.passwordHash || !matches) return { ok: false, error: "Wrong email or password." };
  if (!user.emailVerifiedAt) {
    return { ok: false, error: "Confirm your email first, with the link we sent when you signed up.", unconfirmed: true };
  }
  return { ok: true, userId: user.id };
}

// Always answers the same, so the form doesn't reveal who has an account
export async function requestPasswordReset(rawEmail: string, ip: string): Promise<Outcome> {
  const email = normalizeEmail(rawEmail);
  if (!isEmail(email)) return { ok: false, error: "Enter a valid email address." };
  if (!withinLimit(`reset:${ip}`, 10, HOUR) || !withinLimit(`email:${email}`, 3, HOUR)) {
    return { ok: false, error: TOO_MANY };
  }
  const user = await findByEmail(email);
  if (user && !(await trySending(() => sendResetLink(user.id, email)))) return { ok: false, error: NOT_SENT };
  return { ok: true };
}

// Sets the new password and logs out every device; returns the account to log in to.
// The link also confirms the email, since only its owner could open it.
export async function resetPassword(token: string, password: string): Promise<{ ok: true; userId: string } | Failure> {
  const link = await linkWorks(token, "reset");
  if (!link) return { ok: false, error: "This link has expired. Ask for a new one." };
  const problem = passwordProblem(password, null);
  if (problem) return { ok: false, error: problem };

  const used = await consumeLink(token, "reset");
  if (!used) return { ok: false, error: "This link has expired. Ask for a new one." };
  const passwordHash = await hashPassword(password);
  const [user] = await db
    .update(users)
    .set({ passwordHash, emailVerifiedAt: sql`coalesce(${users.emailVerifiedAt}, now())` })
    .where(and(eq(users.id, used.userId), eq(users.email, used.email)))
    .returning({ id: users.id });
  if (!user) return { ok: false, error: "This link has expired. Ask for a new one." };
  await db.delete(sessions).where(eq(sessions.userId, user.id));
  await db.delete(emailTokens).where(and(eq(emailTokens.userId, user.id), eq(emailTokens.purpose, "reset")));
  return { ok: true, userId: user.id };
}

// Run by the worker: sign-ups nobody confirmed, and links nobody used
export async function deleteUnconfirmedAccounts(): Promise<number> {
  const cutoff = new Date(Date.now() - UNCONFIRMED_TTL_MS);
  const deleted = await db
    .delete(users)
    .where(
      and(
        isNull(users.emailVerifiedAt),
        isNotNull(users.passwordHash),
        isNull(users.spotifyId),
        lt(users.createdAt, cutoff),
      ),
    )
    .returning({ id: users.id });
  await db.delete(emailTokens).where(lt(emailTokens.expiresAt, new Date()));
  return deleted.length;
}
