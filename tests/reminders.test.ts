import assert from "node:assert/strict";
import { after, beforeEach, describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { spotifyTokens, users } from "@/lib/db/schema";
import { outbox } from "@/lib/email";
import { sendDueReminders, unsubscribe, unsubscribeLinkWorks, unsubscribeToken } from "@/lib/reminders";
import { addPlay, addTrack, closeDatabase, resetDatabase, spotifyId } from "./helpers";

const DAY = 24 * 3_600_000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY);
const TRACK = spotifyId("one");

// An account made with an email, confirmed, that asked for reminders
async function account(name: string, values: Partial<typeof users.$inferInsert> = {}) {
  const [user] = await db
    .insert(users)
    .values({
      username: name,
      displayName: name,
      email: `${name}@example.com`,
      emailVerifiedAt: daysAgo(90),
      passwordHash: "hash",
      importReminders: true,
      createdAt: daysAgo(90),
      ...values,
    })
    .returning();
  return user;
}

const sentTo = () => outbox.map((email) => email.to).sort();

after(closeDatabase);

beforeEach(async () => {
  await resetDatabase();
  outbox.length = 0;
  await addTrack(TRACK, spotifyId("a"), "Artist");
});

describe("import reminders", () => {
  it("go to accounts whose history is over 30 days old, and only to those who asked", async () => {
    const behind = await account("behind");
    await addPlay(behind.id, TRACK, daysAgo(40).toISOString());
    const current = await account("current");
    await addPlay(current.id, TRACK, daysAgo(5).toISOString());
    const notAsked = await account("notasked", { importReminders: false });
    await addPlay(notAsked.id, TRACK, daysAgo(40).toISOString());
    await account("unconfirmed", { emailVerifiedAt: null });
    const live = await account("live");
    await addPlay(live.id, TRACK, daysAgo(40).toISOString());
    await db.insert(spotifyTokens).values({ userId: live.id, accessToken: "a", refreshToken: "r", expiresAt: new Date(), scope: "" });
    await account("empty");
    await account("new", { createdAt: daysAgo(3) });

    assert.equal(await sendDueReminders(), 2);
    assert.deepEqual(sentTo(), ["behind@example.com", "empty@example.com"]);
    const email = outbox.find((sent) => sent.to === "behind@example.com");
    assert.match(email?.subject ?? "", /stop at/);
    assert.match(email?.text ?? "", /\/import/);
    assert.ok(email?.unsubscribeUrl?.includes("/api/unsubscribe?token="));
  });

  it("go out once a month", async () => {
    const behind = await account("behind");
    await addPlay(behind.id, TRACK, daysAgo(40).toISOString());
    assert.equal(await sendDueReminders(), 1);
    assert.equal(await sendDueReminders(), 0, "not again right away");

    await db.update(users).set({ reminderSentAt: daysAgo(31) }).where(eq(users.id, behind.id));
    assert.equal(await sendDueReminders(), 1, "a month later");
  });

  it("stop from the link in the email, which can't be forged", async () => {
    const behind = await account("behind");
    const token = unsubscribeToken(behind.id);
    assert.equal(unsubscribeLinkWorks(token), true);
    assert.equal(unsubscribeLinkWorks(`${token.slice(0, -2)}xx`), false);
    assert.equal(await unsubscribe(`${behind.id}.not-a-signature`), false);

    assert.equal(await unsubscribe(token), true);
    const [after] = await db.select().from(users).where(eq(users.id, behind.id));
    assert.equal(after.importReminders, false);
    assert.equal(await sendDueReminders(), 0);
  });
});
