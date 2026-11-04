// The stats.lk mark: three bars of a level meter inside a rounded square.
export function LogoMark({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={className}>
      <rect width="32" height="32" rx="9" fill="var(--accent-fill)" />
      <rect x="8" y="15" width="4" height="9" rx="2" fill="var(--accent-foreground)" opacity="0.7" />
      <rect x="14" y="8" width="4" height="16" rx="2" fill="var(--accent-foreground)" />
      <rect x="20" y="12" width="4" height="12" rx="2" fill="var(--accent-foreground)" opacity="0.85" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2 font-semibold tracking-tight">
      <LogoMark />
      <span>
        stats<span className="text-accent">.lk</span>
      </span>
    </span>
  );
}
