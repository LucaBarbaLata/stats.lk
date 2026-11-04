"use client";

import { Activity, ChartColumn, Gift, House, Lightbulb, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Overview", match: "/dashboard", icon: House },
  { href: "/top/tracks", label: "Top", match: "/top", icon: ChartColumn },
  { href: "/activity", label: "Activity", match: "/activity", icon: Activity },
  { href: "/insights/compare", label: "Insights", match: "/insights", icon: Lightbulb },
  { href: "/wrapped", label: "Wrapped", match: "/wrapped", icon: Gift },
  { href: "/friends", label: "Friends", match: "/friends", icon: Users },
];

// Phones get a bottom tab bar with the five most used sections
const MOBILE_LINKS = LINKS.filter((link) => link.href !== "/wrapped");

// Both navs read the URL to highlight the current section, so each must sit
// behind a <Suspense> boundary with its *Fallback twin as the fallback.

export function DesktopNav() {
  return <Desktop pathname={usePathname()} />;
}

export function DesktopNavFallback() {
  return <Desktop pathname={null} />;
}

export function MobileNav() {
  return <Mobile pathname={usePathname()} />;
}

export function MobileNavFallback() {
  return <Mobile pathname={null} />;
}

const isActive = (pathname: string | null, match: string) => pathname?.startsWith(match) ?? false;

function Desktop({ pathname }: { pathname: string | null }) {
  return (
    <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
      {LINKS.map((link) => {
        const active = isActive(pathname, link.match);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-full px-3 py-1.5 text-sm transition ${active ? "bg-surface-2 font-medium text-foreground" : "text-muted hover:text-foreground"}`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Mobile({ pathname }: { pathname: string | null }) {
  return (
    <nav
      aria-label="Main"
      data-mobile-nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {MOBILE_LINKS.map((link) => {
          const active = isActive(pathname, link.match);
          const Icon = link.icon;
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-1 py-2.5 text-[11px] transition ${active ? "text-foreground" : "text-subtle hover:text-muted"}`}
              >
                <Icon className={`size-5 ${active ? "text-accent" : ""}`} />
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
