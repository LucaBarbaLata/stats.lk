import { Eye, EyeOff } from "lucide-react";
import { setItemHidden } from "@/app/actions";
import { buttonClass } from "@/components/ui";
import { isHidden, type HiddenType } from "@/lib/hidden";

// "Hide from others" on artist and track pages. The viewer's own stats keep
// the item either way.
export async function HideButton({ userId, type, itemId }: { userId: string; type: HiddenType; itemId: string }) {
  const hidden = await isHidden(userId, type, itemId);
  return (
    <form action={setItemHidden.bind(null, type, itemId, !hidden)}>
      <button
        className={buttonClass("ghost", "sm")}
        title={hidden ? "Hidden from your profile, friends and share cards" : undefined}
      >
        {hidden ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
        {hidden ? "Hidden from others · Show" : "Hide from others"}
      </button>
    </form>
  );
}
