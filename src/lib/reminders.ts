import { eq, sql } from "drizzle-orm";
import { sign, signatureMatches } from "./crypto";
import { formatDate } from "./dates";
import { db } from "./db";
import { users } from "./db/schema";
import { sendEmail } from "./email";
import { appUrl } from "./env";

// The import reminder (phase 8 in PLAN.md): accounts without Spotify only
// have the history they import, so on request they get an email once a
// month while their newest play is over 30 days old. Off by default; turned
// on in Settings → Your data, off there or from the link in every email.

const SPOTIFY_PRIVACY_URL = "https://www.spotify.com/account/privacy/";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Unsubscribing works without logging in, so the link carries a signature
export function unsubscribeToken(userId: string): string {
  return `${userId}.${sign(`unsubscribe:${userId}`)}`;
}

function userFromToken(token: string): string | null {
  const [userId, signature] = token.split(".");
  if (!userId || !signature || !UUID.test(userId)) return null;
  return signatureMatches(`unsubscribe:${userId}`, signature) ? userId : null;
}

export function unsubscribeLinkWorks(token: string): boolean {
  return userFromToken(token) !== null;
}

export async function unsubscribe(token: string): Promise<boolean> {
  const userId = userFromToken(token);
  if (!userId) return false;
  await db.update(users).set({ importReminders: false }).where(eq(users.id, userId));
  return true;
}

export async function setImportReminders(userId: string, on: boolean): Promise<void> {
  await db.update(users).set({ importReminders: on }).where(eq(users.id, userId));
}

type Due = { id: string; email: string; lastPlayedMs: number | null };

// Asked for it, has a confirmed email and no Spotify, the newest play (or the
// sign-up, before any import) is over 30 days old, and no reminder went out
// in the last 30 days
function dueReminders(limit: number) {
  return db.execute<Due>(sql`
    select u.id, u.email, (extract(epoch from p.last_played_at) * 1000)::float8 as "lastPlayedMs"
    from users u
    cross join lateral (select max(s.played_at) as last_played_at from streams s where s.user_id = u.id) p
    where u.import_reminders and u.email is not null and u.email_verified_at is not null
      and not exists (select 1 from spotify_tokens st where st.user_id = u.id)
      and (u.reminder_sent_at is null or u.reminder_sent_at < now() - interval '30 days')
      and coalesce(p.last_played_at, u.created_at) < now() - interval '30 days'
    order by u.reminder_sent_at asc nulls first
    limit ${limit}`);
}

function reminderEmail(user: Due) {
  const app = appUrl();
  const until = user.lastPlayedMs === null ? null : formatDate(new Date(user.lastPlayedMs));
  const unsubscribeUrl = `${app}/unsubscribe?token=${encodeURIComponent(unsubscribeToken(user.id))}`;
  return {
    to: user.email,
    subject: until ? `Your stats.lk stats stop at ${until}` : "Your stats.lk account is waiting for your history",
    text: [
      "Hi,",
      "",
      until
        ? `Your stats on stats.lk run until ${until}. To bring them up to date, ask Spotify for a new export:`
        : "You haven't imported your Spotify history yet, so stats.lk has nothing to show. Ask Spotify for it here:",
      SPOTIFY_PRIVACY_URL,
      "",
      "Tick “Extended streaming history”, request it and confirm the email Spotify sends. When the ZIP arrives, usually within a few days, upload it here:",
      `${app}/import`,
      ...(until ? ["Plays you already imported stay; only new ones are added."] : []),
      "",
      `You get this once a month because you turned on import reminders. To stop them: ${unsubscribeUrl}`,
      "",
      "stats.lk",
    ].join("\n"),
    // One-click unsubscribing from the mail app, see src/app/api/unsubscribe
    unsubscribeUrl: `${app}/api/unsubscribe?token=${encodeURIComponent(unsubscribeToken(user.id))}`,
  };
}

// Run by the worker. Returns how many reminders went out.
export async function sendDueReminders(limit = 20): Promise<number> {
  let sent = 0;
  for (const user of await dueReminders(limit)) {
    try {
      await sendEmail(reminderEmail(user));
    } catch (error) {
      console.error(`Reminder to user ${user.id} failed:`, error instanceof Error ? error.message : error);
      continue;
    }
    await db.update(users).set({ reminderSentAt: new Date() }).where(eq(users.id, user.id));
    sent++;
  }
  return sent;
}
