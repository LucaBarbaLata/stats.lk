"use client";

import { RotateCw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { buttonClass } from "@/components/ui";

// Shown inside the app shell when a page fails to load (database down,
// Spotify unreachable, ...). The navigation keeps working.
export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof Error && "digest" in error ? String(error.digest) : null;
  return (
    <div className="flex flex-col items-center gap-5 py-24 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-red-500/10 text-red-300">
        <TriangleAlert className="size-7" />
      </span>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">This page didn&apos;t load</h1>
        <p className="max-w-sm text-muted">
          Something went wrong on our side. Try again in a moment; your plays are still being saved.
        </p>
        {digest && <p className="text-xs text-subtle">Error code {digest}</p>}
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => retry()} className={buttonClass("primary")}>
          <RotateCw className="size-4" /> Try again
        </button>
        <Link href="/dashboard" className={buttonClass("secondary")}>
          Go to overview
        </Link>
      </div>
    </div>
  );
}
