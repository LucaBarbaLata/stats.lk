"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  logIn,
  requestPasswordReset,
  resendVerification,
  resetPassword,
  signUp,
  verifyEmail,
} from "@/lib/accounts";
import { withinLimit } from "@/lib/rate-limit";
import { unsubscribe } from "@/lib/reminders";
import { createSession, getCurrentUser } from "@/lib/session";
import { isUsernameTaken, normalizeUsername, USERNAME_PATTERN } from "@/lib/usernames";
import type { UsernameCheck } from "./(app)/settings/actions";

// What the login, sign-up and password forms show after submitting
export type AuthFormState = {
  error?: string;
  // The address a link was just sent to
  sentTo?: string;
  // A login refused because the email isn't confirmed yet
  unconfirmed?: boolean;
  // Finished, with nothing else to show (unsubscribing)
  done?: boolean;
} | null;

const field = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
};

// The visitor's address. Apache adds the real one at the end of
// X-Forwarded-For; anything before it came from the visitor and can be faked.
async function clientIp(): Promise<string> {
  const list = await headers();
  const forwarded = list.get("x-forwarded-for")?.split(",").at(-1)?.trim();
  return forwarded || list.get("x-real-ip") || "local";
}

async function startSession(userId: string): Promise<void> {
  const cookie = await createSession(userId, (await headers()).get("user-agent"));
  (await cookies()).set(cookie);
}

export async function signUpAction(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = field(formData, "email");
  const result = await signUp(
    { email, password: field(formData, "password"), username: field(formData, "username") },
    await clientIp(),
  );
  return result.ok ? { sentTo: email.trim().toLowerCase() } : { error: result.error };
}

export async function resendVerificationAction(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = field(formData, "email");
  const result = await resendVerification(email, await clientIp());
  return result.ok ? { sentTo: email.trim().toLowerCase() } : { error: result.error };
}

export async function verifyEmailAction(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const result = await verifyEmail(field(formData, "token"));
  if (!result) return { error: "This link has expired or was already used." };
  if (result === "taken") return { error: "Another account uses this email now, so it can't be added to yours." };
  // Already logged in to this account here (a change made from Settings)
  if ((await getCurrentUser())?.id !== result.userId) await startSession(result.userId);
  redirect(result.changed ? "/settings/login?confirmed=1" : "/dashboard");
}

export async function logInAction(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const result = await logIn(field(formData, "email"), field(formData, "password"), await clientIp());
  if (!result.ok) return { error: result.error, unconfirmed: result.unconfirmed };
  await startSession(result.userId);
  redirect("/dashboard");
}

export async function requestResetAction(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = field(formData, "email");
  const result = await requestPasswordReset(email, await clientIp());
  return result.ok ? { sentTo: email.trim().toLowerCase() } : { error: result.error };
}

export async function resetPasswordAction(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const result = await resetPassword(field(formData, "token"), field(formData, "password"));
  if (!result.ok) return { error: result.error };
  await startSession(result.userId);
  redirect("/dashboard");
}

// From the link in a reminder email; works without logging in
export async function unsubscribeAction(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  return (await unsubscribe(field(formData, "token"))) ? { done: true } : { error: "This link doesn't work." };
}

// Checked while typing a username on the sign-up form
export async function checkNewUsername(input: unknown): Promise<UsernameCheck> {
  if (typeof input !== "string" || !withinLimit(`username:${await clientIp()}`, 120, 60_000)) return "invalid";
  const username = normalizeUsername(input);
  if (!USERNAME_PATTERN.test(username)) return "invalid";
  return (await isUsernameTaken(username)) ? "taken" : "available";
}
