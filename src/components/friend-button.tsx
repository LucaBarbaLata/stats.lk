import { acceptFriend, addFriend, removeFriend } from "@/app/actions";
import { buttonClass } from "@/components/ui";
import type { Relation } from "@/lib/social";

const primary = buttonClass("primary", "sm");
const secondary = buttonClass("secondary", "sm");

// The friendship actions that fit the current relation
export function FriendButton({ userId, relation }: { userId: string; relation: Relation }) {
  if (relation === "self") return null;
  if (relation === "none") {
    return (
      <form action={addFriend.bind(null, userId)}>
        <button className={primary}>Add friend</button>
      </form>
    );
  }
  if (relation === "incoming") {
    return (
      <div className="flex gap-2">
        <form action={acceptFriend.bind(null, userId)}>
          <button className={primary}>Accept</button>
        </form>
        <form action={removeFriend.bind(null, userId)}>
          <button className={secondary}>Decline</button>
        </form>
      </div>
    );
  }
  return (
    <form action={removeFriend.bind(null, userId)}>
      <button className={secondary}>{relation === "outgoing" ? "Cancel request" : "Remove friend"}</button>
    </form>
  );
}
