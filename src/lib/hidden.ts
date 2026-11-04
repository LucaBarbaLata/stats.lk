import { and, eq, sql } from "drizzle-orm";
import { db } from "./db";
import { hiddenItems } from "./db/schema";

export type HiddenType = "artist" | "track";

export async function isHidden(userId: string, type: HiddenType, itemId: string): Promise<boolean> {
  const [row] = await db
    .select({ itemId: hiddenItems.itemId })
    .from(hiddenItems)
    .where(and(eq(hiddenItems.userId, userId), eq(hiddenItems.type, type), eq(hiddenItems.itemId, itemId)));
  return Boolean(row);
}

export async function setHidden(userId: string, type: HiddenType, itemId: string, hidden: boolean) {
  if (hidden) {
    await db.insert(hiddenItems).values({ userId, type, itemId }).onConflictDoNothing();
  } else {
    await db
      .delete(hiddenItems)
      .where(and(eq(hiddenItems.userId, userId), eq(hiddenItems.type, type), eq(hiddenItems.itemId, itemId)));
  }
}

// The user's hidden artists and tracks with their names, newest first
export function getHiddenItems(userId: string) {
  return db.execute<{ type: HiddenType; itemId: string; name: string; imageUrl: string | null }>(sql`
    select h.type, h.item_id as "itemId",
      coalesce(a.name, t.name, h.item_id) as name,
      coalesce(a.image_url, al.image_url) as "imageUrl"
    from hidden_items h
    left join artists a on h.type = 'artist' and a.id = h.item_id
    left join tracks t on h.type = 'track' and t.id = h.item_id
    left join albums al on al.id = t.album_id
    where h.user_id = ${userId}::uuid
    order by h.created_at desc`);
}
