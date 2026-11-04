import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { Logo } from "@/components/logo";
import { LiveSync } from "@/components/live-sync";
import { DesktopNav, DesktopNavFallback, MobileNav, MobileNavFallback } from "@/components/nav-links";
import { UserMenu } from "@/components/user-menu";
import { buttonClass } from "@/components/ui";
import { isAdmin } from "@/lib/env";
import { getCurrentUser } from "@/lib/session";

// Shell for the app pages. Pages render behind ./loading.tsx, so they can read
// the session, params and searchParams directly. Each page checks the login
// itself (requireUser), because public profiles are open to visitors too.
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <LiveSync />
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-6 px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" aria-label="stats.lk overview">
              <Logo />
            </Link>
            <Suspense fallback={<DesktopNavFallback />}>
              <Nav />
            </Suspense>
          </div>
          <Suspense fallback={<div className="size-9 rounded-full bg-surface" />}>
            <Account />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-8 pb-12 sm:px-6 md:pt-10 md:pb-16">{children}</main>
      <Suspense fallback={<MobileNavFallback />}>
        <Nav mobile />
      </Suspense>
    </div>
  );
}

// Visitors on a public profile get no app navigation
async function Nav({ mobile }: { mobile?: boolean }) {
  const user = await getCurrentUser();
  if (!user) return null;
  return mobile ? <MobileNav /> : <DesktopNav />;
}

async function Account() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <div className="flex items-center gap-1">
        <Link href="/" className={buttonClass("ghost", "sm")}>
          What&apos;s stats.lk?
        </Link>
        <Link href="/login" className={buttonClass("primary", "sm")}>
          Log in
        </Link>
      </div>
    );
  }
  return (
    <UserMenu
      displayName={user.displayName}
      avatarUrl={user.avatarUrl}
      profileHref={`/u/${user.username}`}
      isAdmin={isAdmin(user.spotifyId)}
    />
  );
}
