import { Lock, UserPlus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Cover } from "@/components/cover";
import { FriendButton } from "@/components/friend-button";
import { buttonClass, EmptyState, Notice, PageHeader } from "@/components/ui";
import { FriendsNowPlaying } from "@/components/now-playing";
import { formatRelative } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { getFriendsFeed, getNowPlaying, listPeople, type Person } from "@/lib/social";

export const metadata: Metadata = { title: "Friends" };

export default async function FriendsPage() {
  const user = await requireUser();
  const people = await listPeople(user.id);
  const friends = people.filter((person) => person.relation === "friends");
  const requests = people.filter((person) => person.relation === "incoming");
  const others = people.filter((person) => person.relation === "none" || person.relation === "outgoing");
  const friendIds = friends.map((friend) => friend.id);
  const [listening, feed] = await Promise.all([getNowPlaying(user.id, friendIds), getFriendsFeed(user.id, 30)]);

  return (
    <div className="space-y-12">
      <PageHeader title="Friends" description="See what your friends play, and compare your taste with theirs." />

      {user.visibility === "private" && (
        <Notice
          icon={Lock}
          title="Your profile is private"
          action={
            <Link href="/settings" className={buttonClass("primary", "sm")}>
              Share with friends
            </Link>
          }
        >
          Friends can&apos;t see your plays until you share your profile with them.
        </Notice>
      )}

      {requests.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Friend requests</h2>
          <PeopleList people={requests} />
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Listening now</h2>
        {friends.length ? (
          <FriendsNowPlaying userIds={friendIds} initial={listening} />
        ) : (
          <EmptyState icon={UserPlus} title="No friends yet">
            Add people below to see what they&apos;re listening to.
          </EmptyState>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Your friends</h2>
        {friends.length ? (
          <PeopleList people={friends} />
        ) : (
          <p className="rounded-2xl bg-surface px-5 py-4 text-sm text-muted">Your friends show up here once they accept.</p>
        )}
      </section>

      {feed.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Recently played by friends</h2>
          <ul className="-mx-2">
            {feed.map((item) => (
              <li key={item.id} className="flex items-center gap-3 rounded-xl px-2 py-2">
                <Cover src={item.imageUrl} size={44} label={item.trackName} />
                <div className="min-w-0 flex-1">
                  <Link href={`/track/${item.trackId}`} className="block truncate font-medium hover:underline">
                    {item.trackName}
                  </Link>
                  <p className="truncate text-sm text-muted">
                    {item.artistNames} ·{" "}
                    <Link href={`/u/${item.username}`} className="text-foreground hover:underline">
                      {item.displayName}
                    </Link>
                  </p>
                </div>
                <time className="shrink-0 text-sm text-muted" dateTime={new Date(item.playedMs).toISOString()}>
                  {formatRelative(new Date(item.playedMs))}
                </time>
              </li>
            ))}
          </ul>
        </section>
      )}

      {others.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">People on stats.lk</h2>
          <PeopleList people={others} />
        </section>
      )}
    </div>
  );
}

function PeopleList({ people }: { people: Person[] }) {
  return (
    <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl bg-surface">
      {people.map((person) => (
        <li key={person.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
          <Link href={`/u/${person.username}`} className="flex min-w-0 flex-1 items-center gap-3">
            <Cover src={person.avatarUrl} size={40} rounded label={person.displayName} />
            <span className="truncate font-medium hover:underline">{person.displayName}</span>
          </Link>
          <FriendButton userId={person.id} relation={person.relation} />
        </li>
      ))}
    </ul>
  );
}
