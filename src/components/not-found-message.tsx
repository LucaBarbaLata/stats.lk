import { Disc3 } from "lucide-react";
import Link from "next/link";
import { buttonClass } from "@/components/ui";

export function NotFoundMessage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 py-24 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-surface text-muted">
        <Disc3 className="size-7" />
      </span>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">This page isn&apos;t here</h1>
        <p className="max-w-sm text-muted">
          The link may be old, or the artist, track or profile isn&apos;t in stats.lk yet.
        </p>
      </div>
      <Link href="/dashboard" className={buttonClass("primary")}>
        Go to your stats
      </Link>
    </div>
  );
}
