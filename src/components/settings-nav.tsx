"use client";

import { Database, KeyRound, Laptop, Link2, Shield, SlidersHorizontal, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export const SETTINGS_GROUPS = [
  {
    label: "Account",
    tabs: [
      { href: "/settings/profile", label: "Profile", icon: UserRound },
      { href: "/settings/privacy", label: "Privacy", icon: Shield },
      { href: "/settings/login", label: "Login", icon: KeyRound },
      { href: "/settings/connections", label: "Connections", icon: Link2 },
      { href: "/settings/sessions", label: "Sessions", icon: Laptop },
    ],
  },
  {
    label: "Stats and data",
    tabs: [
      { href: "/settings/preferences", label: "Preferences", icon: SlidersHorizontal },
      { href: "/settings/data", label: "Your data", icon: Database },
    ],
  },
];

// Reads the URL, so it sits behind <Suspense> with SettingsNavFallback.
// `attention` marks tabs with something worth a look (a dot).
export function SettingsNav({ attention = [] }: { attention?: string[] }) {
  return <Menu pathname={usePathname()} attention={attention} />;
}

export function SettingsNavFallback() {
  return <Menu pathname={null} attention={[]} />;
}

function Dot() {
  return (
    <>
      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-accent" />
      <span className="sr-only">(worth a look)</span>
    </>
  );
}

const itemClass = (active: boolean) =>
  `flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm whitespace-nowrap transition ${active ? "bg-surface font-medium text-accent" : "text-muted hover:bg-surface hover:text-foreground"}`;

// Grouped under headings from large screens up; one scrolling row of tabs on phones
function Menu({ pathname, attention }: { pathname: string | null; attention: string[] }) {
  return (
    <nav aria-label="Settings">
      <ul className="-mx-4 flex gap-1 overflow-x-auto px-4 [scrollbar-width:none] lg:hidden">
        {SETTINGS_GROUPS.flatMap((group) => group.tabs).map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link href={href} aria-current={pathname === href ? "page" : undefined} className={itemClass(pathname === href)}>
              <Icon className="size-4" />
              {label}
              {attention.includes(href) && <Dot />}
            </Link>
          </li>
        ))}
      </ul>
      <div className="hidden space-y-7 lg:block">
        {SETTINGS_GROUPS.map((group) => (
          <div key={group.label} className="space-y-1.5">
            <p className="px-3 text-[15px] font-semibold">{group.label}</p>
            <ul className="space-y-0.5">
              {group.tabs.map(({ href, label, icon: Icon }) => (
                <li key={href}>
                  <Link href={href} aria-current={pathname === href ? "page" : undefined} className={itemClass(pathname === href)}>
                    <Icon className="size-4" />
                    {label}
                    {attention.includes(href) && <Dot />}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
