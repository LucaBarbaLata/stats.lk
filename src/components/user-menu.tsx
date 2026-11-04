"use client";

import { ChevronDown, Gift, House, LogOut, Settings, ShieldCheck, Upload, User } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { logout } from "@/app/actions";
import { Cover } from "@/components/cover";

const itemClass =
  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-muted transition hover:bg-surface-3 hover:text-foreground";

// Avatar button that opens the account menu. Closes on outside click,
// Escape and navigation.
export function UserMenu({
  displayName,
  avatarUrl,
  profileHref,
  isAdmin,
}: {
  displayName: string;
  avatarUrl: string | null;
  profileHref: string;
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-full p-1 pr-2 transition hover:bg-surface-2"
      >
        <Cover src={avatarUrl} size={28} rounded label={displayName} />
        <span className="hidden max-w-32 truncate text-sm sm:inline">{displayName}</span>
        <ChevronDown className={`size-4 text-muted transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 w-56 rounded-2xl border border-border bg-surface-2 p-1.5 shadow-2xl shadow-black/40"
        >
          <Link role="menuitem" href={profileHref} onClick={close} className={itemClass}>
            <User className="size-4" /> Your profile
          </Link>
          <Link role="menuitem" href="/wrapped" onClick={close} className={`${itemClass} md:hidden`}>
            <Gift className="size-4" /> Wrapped
          </Link>
          <Link role="menuitem" href="/import" onClick={close} className={itemClass}>
            <Upload className="size-4" /> Import history
          </Link>
          <Link role="menuitem" href="/settings" onClick={close} className={itemClass}>
            <Settings className="size-4" /> Settings
          </Link>
          {isAdmin && (
            <Link role="menuitem" href="/admin" onClick={close} className={itemClass}>
              <ShieldCheck className="size-4" /> Admin
            </Link>
          )}
          <div className="my-1.5 h-px bg-border" />
          <Link role="menuitem" href="/" onClick={close} className={itemClass}>
            <House className="size-4" /> stats.lk home page
          </Link>
          <form action={logout}>
            <button role="menuitem" className={itemClass}>
              <LogOut className="size-4" /> Log out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
