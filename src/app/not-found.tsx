import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { NotFoundMessage } from "@/components/not-found-message";

export const metadata: Metadata = { title: "Page not found" };

// For URLs outside the app; pages inside it use (app)/not-found.tsx
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 sm:px-6">
      <div className="flex h-16 items-center">
        <Link href="/" aria-label="stats.lk home">
          <Logo />
        </Link>
      </div>
      <NotFoundMessage />
    </main>
  );
}
