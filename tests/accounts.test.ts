import assert from "node:assert/strict";
import { after, beforeEach, describe, it, mock } from "node:test";
import { eq } from "drizzle-orm";
import {
  addLogin,
  changeEmail,
  changePassword,
  deleteUnconfirmedAccounts,
  linkWorks,
  logIn,
  pendingEmail,
  requestPasswordReset,
  resendVerification,
  resetPassword,
  signUp,
  signupsOpen,
  verifyEmail,
} from "@/lib/accounts";
import { db } from "@/lib/db";
import { emailTokens, sessions, users } from "@/lib/db/schema";
import { outbox } from "@/lib/email";
import { clearLimits } from "@/lib/rate-limit";
import { hasSpotifyTokens } from "@/lib/spotify/tokens";
import { linkSpotifyAccount } from "@/lib/users";
import { closeDatabase, createUser, resetDatabase } from "./helpers";

const IP = "203.0.113.7";
const PASSWORD = "correct horse battery";

const newAccount = (overrides: Partial<{ email: string; password: string; username: string }> = {}) => ({
  email: "Ana@Example.com",
  password: PASSWORD,
  username: "ana",
  ...overrides,
});

// The token from the newest email's link
function lastLinkToken(): string {
  const match = outbox.at(-1)?.text.match(/token=(\S+)/);
  assert.ok(match, "the email has a link");
  return decodeURIComponent(match[1]);
}

async function confirmedAccount() {
  assert.deepEqual(await signUp(newAccount(), IP), { ok: true });
  assert.ok(await verifyEmail(lastLinkToken(), PASSWORD));
}

const accountByEmail = async (email = "ana@example.com") =>
  (await db.select().from(users).where(eq(users.email, email)))[0];

after(closeDatabase);

beforeEach(async () => {
  await resetDatabase();
  clearLimits();
  outbox.length = 0;
  delete process.env.MAX_ACCOUNTS;
});

describe("signing up", () => {
  it("creates an unconfirmed account and emails a link that confirms it", async () => {
    assert.deepEqual(await signUp(newAccount(), IP), { ok: true });
    const account = await accountByEmail();
    assert.equal(account.username, "ana");
    assert.equal(account.spotifyId, null);
    assert.equal(account.emailVerifiedAt, null);
    assert.notEqual(account.passwordHash, PASSWORD, "only a hash is stored");
    assert.equal(outbox.at(-1)?.to, "ana@example.com");

    const token = lastLinkToken();
    assert.deepEqual(await verifyEmail(token, PASSWORD), { userId: account.id, changed: false });
    assert.ok((await accountByEmail()).emailVerifiedAt);
    assert.equal(await verifyEmail(token, PASSWORD), null, "a link works once");
  });

  it("refuses to log in until the email is confirmed", async () => {
    await signUp(newAccount(), IP);
    const refused = await logIn("ana@example.com", PASSWORD, IP);
    assert.equal(refused.ok, false);
    assert.equal(!refused.ok && refused.unconfirmed, true);

    assert.deepEqual(await resendVerification("ana@example.com", IP), { ok: true });
    assert.ok(await verifyEmail(lastLinkToken(), PASSWORD), "the new link confirms it");
    assert.equal((await logIn(" ANA@example.com ", PASSWORD, IP)).ok, true);
  });

  it("answers the same for an email that has an account, and tells its owner", async () => {
    await confirmedAccount();
    const sentBefore = outbox.length;
    assert.deepEqual(await signUp(newAccount({ username: "someone" }), IP), { ok: true });
    assert.equal((await db.select().from(users)).length, 1, "no second account");
    assert.equal(outbox.length, sentBefore + 1);
    assert.match(outbox.at(-1)?.subject ?? "", /already have/);
  });

  it("only confirms with the account's password", async () => {
    await signUp(newAccount(), IP);
    const token = lastLinkToken();
    assert.equal(await verifyEmail(token, "some other password"), "password");
    assert.equal((await accountByEmail()).emailVerifiedAt, null);
    assert.ok(await verifyEmail(token, PASSWORD), "a wrong try doesn't use the link up");
  });

  it("slows down guessing the password of a link", async () => {
    await signUp(newAccount(), IP);
    const token = lastLinkToken();
    for (let i = 0; i < 10; i++) await verifyEmail(token, "wrong password");
    assert.equal(await verifyEmail(token, PASSWORD), "limited");
  });

  // Someone signs up with an address that isn't theirs, before its owner does
  it("doesn't leave the account to someone who took the address first", async () => {
    const OTHER = "someone else's password";
    await signUp(newAccount({ password: OTHER, username: "other" }), "198.51.100.1");
    const otherLink = lastLinkToken();
    await signUp(newAccount(), IP);
    assert.equal((await db.select().from(users)).length, 1);

    assert.equal(await verifyEmail(otherLink, OTHER), "password", "their password stopped counting");
    assert.ok(await verifyEmail(lastLinkToken(), PASSWORD));
    assert.equal((await accountByEmail()).username, "ana");
    assert.equal((await logIn("ana@example.com", OTHER, IP)).ok, false);
    assert.equal((await logIn("ana@example.com", PASSWORD, IP)).ok, true);
  });

  it("doesn't confirm for someone who signs up right after the owner either", async () => {
    const OTHER = "someone else's password";
    await signUp(newAccount(), IP);
    await signUp(newAccount({ password: OTHER, username: "other" }), "198.51.100.1");
    assert.equal(await verifyEmail(lastLinkToken(), PASSWORD), "password");
    assert.equal((await logIn("ana@example.com", OTHER, IP)).ok, false, "not confirmed");

    await requestPasswordReset("ana@example.com", IP);
    assert.equal((await resetPassword(lastLinkToken(), PASSWORD)).ok, true, "the owner gets it by resetting");
    assert.equal((await logIn("ana@example.com", OTHER, IP)).ok, false);
  });

  it("leaves a confirmed account alone when someone signs up with its email", async () => {
    await confirmedAccount();
    await signUp(newAccount({ password: "someone else's password", username: "other" }), IP);
    assert.equal((await accountByEmail()).username, "ana");
    assert.equal((await logIn("ana@example.com", PASSWORD, IP)).ok, true);
  });

  it("checks the username, the email and the password", async () => {
    assert.equal((await signUp(newAccount({ username: "Not Allowed!" }), IP)).ok, false);
    assert.equal((await signUp(newAccount({ email: "not an email" }), IP)).ok, false);
    assert.equal((await signUp(newAccount({ password: "short" }), IP)).ok, false);
    assert.equal((await signUp(newAccount({ password: "ana@example.com" }), IP)).ok, false);
    assert.equal(outbox.length, 0);

    assert.equal((await signUp(newAccount(), IP)).ok, true);
    const sameUsername = await signUp(newAccount({ email: "other@example.com" }), IP);
    assert.deepEqual(sameUsername, { ok: false, error: "That username is taken. Try another." });
  });

  it("closes at the account limit", async () => {
    process.env.MAX_ACCOUNTS = "1";
    await createUser();
    assert.equal(await signupsOpen(), false);
    assert.deepEqual(await signUp(newAccount(), IP), { ok: false, error: "Sign-ups are closed for now. Try again later." });
  });

  it("doesn't keep an account whose email couldn't be sent", async () => {
    // In production without SMTP settings, sending fails
    const nodeEnv = process.env.NODE_ENV;
    const logged = mock.method(console, "error", () => {});
    Object.assign(process.env, { NODE_ENV: "production" });
    try {
      const result = await signUp(newAccount(), IP);
      assert.equal(result.ok, false);
    } finally {
      Object.assign(process.env, { NODE_ENV: nodeEnv });
      logged.mock.restore();
    }
    assert.equal(await accountByEmail(), undefined, "the email and username are free again");
  });
});

describe("logging in", () => {
  it("gives the same answer for a wrong password and an unknown email", async () => {
    await confirmedAccount();
    const wrongPassword = await logIn("ana@example.com", "wrong password", IP);
    const unknownEmail = await logIn("nobody@example.com", PASSWORD, IP);
    assert.deepEqual(wrongPassword, unknownEmail);
    assert.deepEqual(wrongPassword, { ok: false, error: "Wrong email or password." });
  });

  it("slows down guessing", async () => {
    await confirmedAccount();
    for (let attempt = 0; attempt < 10; attempt++) await logIn("ana@example.com", `guess ${attempt}`, IP);
    const blocked = await logIn("ana@example.com", PASSWORD, IP);
    assert.equal(blocked.ok, false, "even the right password waits");
    assert.match(!blocked.ok ? blocked.error : "", /Too many/);
  });

  it("doesn't log in Spotify accounts that have no password", async () => {
    const spotifyUser = await createUser();
    await db.update(users).set({ email: "spotify@example.com" }).where(eq(users.id, spotifyUser.id));
    assert.equal((await logIn("spotify@example.com", "anything at all", IP)).ok, false);
  });
});

describe("resetting the password", () => {
  it("sets a new password, logs out other devices and uses the link up", async () => {
    await confirmedAccount();
    const account = await accountByEmail();
    await db.insert(sessions).values({ id: "old-device", userId: account.id, expiresAt: new Date(Date.now() + 3_600_000) });

    assert.deepEqual(await requestPasswordReset("ana@example.com", IP), { ok: true });
    const token = lastLinkToken();
    assert.equal(await linkWorks(token, "reset"), true);

    const tooShort = await resetPassword(token, "short");
    assert.equal(tooShort.ok, false);
    assert.equal(await linkWorks(token, "reset"), true, "a refused password doesn't use the link up");

    assert.deepEqual(await resetPassword(token, "a brand new password"), { ok: true, userId: account.id });
    assert.equal((await logIn("ana@example.com", PASSWORD, IP)).ok, false);
    assert.equal((await logIn("ana@example.com", "a brand new password", IP)).ok, true);
    assert.equal((await db.select().from(sessions).where(eq(sessions.userId, account.id))).length, 0);
    assert.equal((await resetPassword(token, "yet another password")).ok, false);
  });

  it("confirms the email too, since only its owner gets the link", async () => {
    await signUp(newAccount(), IP);
    await requestPasswordReset("ana@example.com", IP);
    await resetPassword(lastLinkToken(), "a brand new password");
    assert.ok((await accountByEmail()).emailVerifiedAt);
  });

  it("answers the same for an unknown email and sends nothing", async () => {
    assert.deepEqual(await requestPasswordReset("nobody@example.com", IP), { ok: true });
    assert.equal(outbox.length, 0);
  });

  it("refuses an expired link", async () => {
    await confirmedAccount();
    await requestPasswordReset("ana@example.com", IP);
    const token = lastLinkToken();
    await db.update(emailTokens).set({ expiresAt: new Date(Date.now() - 1000) });
    assert.equal(await linkWorks(token, "reset"), false);
    assert.equal((await resetPassword(token, "a brand new password")).ok, false);
  });
});

describe("cleaning up", () => {
  it("deletes sign-ups unconfirmed for a day, and nothing else", async () => {
    await signUp(newAccount(), IP);
    await signUp(newAccount({ email: "fresh@example.com", username: "fresh" }), IP);
    await signUp(newAccount({ email: "done@example.com", username: "done" }), IP);
    await verifyEmail(lastLinkToken(), PASSWORD);
    const spotifyUser = await createUser();

    const dayAgo = new Date(Date.now() - 25 * 3_600_000);
    await db.update(users).set({ createdAt: dayAgo });
    await db.update(users).set({ createdAt: new Date() }).where(eq(users.email, "fresh@example.com"));

    assert.equal(await deleteUnconfirmedAccounts(), 1);
    const left = (await db.select().from(users)).map((user) => user.id === spotifyUser.id ? "spotify" : user.username).sort();
    assert.deepEqual(left, ["done", "fresh", "spotify"]);
  });
});

describe("adding an email to a Spotify account", () => {
  it("logs in with it once the link is opened, and Spotify keeps working", async () => {
    const spotifyUser = await createUser();
    assert.deepEqual(await addLogin(spotifyUser.id, { email: "Sam@Example.com", password: PASSWORD }), { ok: true });
    assert.equal(await pendingEmail(spotifyUser.id), "sam@example.com");
    assert.equal((await logIn("sam@example.com", PASSWORD, IP)).ok, false, "not before confirming");

    assert.deepEqual(await verifyEmail(lastLinkToken(), PASSWORD), { userId: spotifyUser.id, changed: true });
    const [account] = await db.select().from(users).where(eq(users.id, spotifyUser.id));
    assert.equal(account.email, "sam@example.com");
    assert.equal(account.spotifyId, spotifyUser.spotifyId);
    assert.equal(await pendingEmail(spotifyUser.id), null);
    assert.deepEqual(await logIn("sam@example.com", PASSWORD, IP), { ok: true, userId: spotifyUser.id });
  });

  it("answers the same for an email with an account, and tells its owner instead", async () => {
    await confirmedAccount();
    const spotifyUser = await createUser();
    outbox.length = 0;
    assert.deepEqual(await addLogin(spotifyUser.id, { email: "ana@example.com", password: PASSWORD }), { ok: true });
    assert.equal(outbox.length, 1);
    assert.doesNotMatch(outbox[0].text, /token=/, "no link to take the address");
    assert.equal(await pendingEmail(spotifyUser.id), null);
  });

  it("only lets the newest link count", async () => {
    const spotifyUser = await createUser();
    await addLogin(spotifyUser.id, { email: "first@example.com", password: PASSWORD });
    const first = lastLinkToken();
    await addLogin(spotifyUser.id, { email: "second@example.com", password: PASSWORD });
    assert.equal(await verifyEmail(first, PASSWORD), null);
    assert.ok(await verifyEmail(lastLinkToken(), PASSWORD));
    assert.equal((await db.select().from(users).where(eq(users.id, spotifyUser.id)))[0].email, "second@example.com");
  });

  it("refuses a link when another account took the address meanwhile", async () => {
    const spotifyUser = await createUser();
    await addLogin(spotifyUser.id, { email: "ana@example.com", password: PASSWORD });
    const token = lastLinkToken();
    await confirmedAccount();
    assert.equal(await verifyEmail(token, PASSWORD), "taken");
  });

  it("answers taken when two accounts get the address at the same time", async () => {
    const one = await createUser();
    const [two] = await db.insert(users).values({ spotifyId: "two", username: "two", displayName: "Two" }).returning();
    const tokens = [];
    for (const user of [one, two]) {
      await addLogin(user.id, { email: "sam@example.com", password: PASSWORD });
      tokens.push(lastLinkToken());
    }
    const results = await Promise.all(tokens.map((token) => verifyEmail(token, PASSWORD)));
    assert.equal(results.filter((result) => result === "taken").length, 1);
  });

  it("keeps the account when it isn't confirmed", async () => {
    const spotifyUser = await createUser();
    await addLogin(spotifyUser.id, { email: "sam@example.com", password: PASSWORD });
    await db.update(users).set({ createdAt: new Date(Date.now() - 25 * 3_600_000) });
    assert.equal(await deleteUnconfirmedAccounts(), 0);
  });
});

describe("changing the email", () => {
  it("needs the password and moves the login once the new address is confirmed", async () => {
    await confirmedAccount();
    const account = await accountByEmail();
    assert.equal((await changeEmail(account.id, { email: "new@example.com", password: "wrong password" })).ok, false);
    assert.deepEqual(await changeEmail(account.id, { email: "New@Example.com", password: PASSWORD }), { ok: true });
    assert.equal((await logIn("ana@example.com", PASSWORD, IP)).ok, true, "the old address works until then");

    await requestPasswordReset("ana@example.com", IP);
    const oldReset = lastLinkToken();
    await changeEmail(account.id, { email: "new@example.com", password: PASSWORD });
    const token = lastLinkToken();
    outbox.length = 0;
    assert.deepEqual(await verifyEmail(token, PASSWORD), { userId: account.id, changed: true });
    assert.equal((await logIn("new@example.com", PASSWORD, IP)).ok, true);
    assert.equal((await logIn("ana@example.com", PASSWORD, IP)).ok, false);
    assert.equal(outbox.at(-1)?.to, "ana@example.com", "the old address hears about it");
    assert.equal((await resetPassword(oldReset, "a brand new password")).ok, false, "old links stop working");
  });

  it("refuses the address it already has", async () => {
    await confirmedAccount();
    const account = await accountByEmail();
    assert.equal((await changeEmail(account.id, { email: "ana@example.com", password: PASSWORD })).ok, false);
  });
});

describe("changing the password", () => {
  it("needs the current one and logs out the other devices", async () => {
    await confirmedAccount();
    const account = await accountByEmail();
    await db.insert(sessions).values([
      { id: "this-device", userId: account.id, expiresAt: new Date(Date.now() + 3_600_000) },
      { id: "other-device", userId: account.id, expiresAt: new Date(Date.now() + 3_600_000) },
    ]);
    const wrong = await changePassword(account.id, { current: "wrong password", password: "a brand new password" }, "this-device");
    assert.equal(wrong.ok, false);
    const tooShort = await changePassword(account.id, { current: PASSWORD, password: "short" }, "this-device");
    assert.equal(tooShort.ok, false);

    assert.deepEqual(
      await changePassword(account.id, { current: PASSWORD, password: "a brand new password" }, "this-device"),
      { ok: true },
    );
    assert.equal((await logIn("ana@example.com", PASSWORD, IP)).ok, false);
    assert.equal((await logIn("ana@example.com", "a brand new password", IP)).ok, true);
    const left = await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.userId, account.id));
    assert.deepEqual(left.map((session) => session.id), ["this-device"]);
  });
});

describe("connecting Spotify to an account", () => {
  const tokens = { access_token: "access", token_type: "Bearer", scope: "", expires_in: 3600, refresh_token: "refresh" };
  const profile = (id: string) => ({ id, display_name: "Ana Popescu", images: [] });

  it("ties it to the account and keeps the name picked here", async () => {
    await confirmedAccount();
    const account = await accountByEmail();
    assert.equal(await hasSpotifyTokens(account.id), false);
    assert.equal(await linkSpotifyAccount(account.id, profile("ana-spotify"), tokens), "linked");
    const [linked] = await db.select().from(users).where(eq(users.id, account.id));
    assert.equal(linked.spotifyId, "ana-spotify");
    assert.equal(linked.displayName, "ana");
    assert.equal(await hasSpotifyTokens(account.id), true);
    assert.equal(await linkSpotifyAccount(account.id, profile("ana-spotify"), tokens), "linked", "reconnecting works");
  });

  it("never merges accounts", async () => {
    await confirmedAccount();
    const account = await accountByEmail();
    const spotifyUser = await createUser();
    assert.equal(await linkSpotifyAccount(account.id, profile(spotifyUser.spotifyId!), tokens), "taken");
    assert.equal(await linkSpotifyAccount(spotifyUser.id, profile("someone-else"), tokens), "other");
    assert.equal(await hasSpotifyTokens(account.id), false);
  });
});
