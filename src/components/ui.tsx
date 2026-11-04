import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ComponentType, ReactNode } from "react";

// The few building blocks every page uses, so pages look alike.

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-accent-fill text-accent-foreground hover:brightness-110",
  secondary: "bg-surface-2 text-foreground hover:bg-surface-3",
  ghost: "text-muted hover:bg-surface-2 hover:text-foreground",
  danger: "bg-red-600 text-white hover:bg-red-500",
};

export function buttonClass(variant: ButtonVariant = "secondary", size: "sm" | "md" = "md") {
  const sizing = size === "sm" ? "h-8 px-3 text-sm gap-1.5" : "h-10 px-4 text-sm gap-2";
  return `inline-flex shrink-0 items-center justify-center rounded-full font-medium whitespace-nowrap transition active:scale-[0.98] ${sizing} ${BUTTON_VARIANTS[variant]}`;
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0 space-y-2">
        <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.02em] text-balance sm:text-[34px]">
          {title}
        </h1>
        {description && <p className="max-w-2xl text-pretty text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

// A round icon chip, the same everywhere a heading or card has an icon
export function IconChip({
  icon: Icon,
  tone = "accent",
  size = "md",
}: {
  icon: ComponentType<{ className?: string }>;
  tone?: "accent" | "muted";
  size?: "sm" | "md" | "lg";
}) {
  const sizing = { sm: "size-8 [&>svg]:size-4", md: "size-9 [&>svg]:size-[18px]", lg: "size-11 [&>svg]:size-5" }[size];
  const colors = tone === "accent" ? "bg-accent-fill/15 text-accent" : "bg-surface-2 text-muted";
  return (
    <span aria-hidden className={`flex shrink-0 items-center justify-center rounded-full ${sizing} ${colors}`}>
      <Icon />
    </span>
  );
}

// A titled block. With `card` it sits on its own surface, the heading
// separated from the content by a line.
export function Section({
  title,
  description,
  href,
  linkLabel = "See all",
  icon,
  badge,
  card,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  href?: string;
  linkLabel?: string;
  icon?: ComponentType<{ className?: string }>;
  // Shown next to the title (a "Live" pill, a count, ...)
  badge?: ReactNode;
  card?: boolean;
  children: ReactNode;
}) {
  const heading = (
    <div className={`flex justify-between gap-4 ${icon ? "items-center" : "items-end"}`}>
      <div className="flex min-w-0 items-center gap-3">
        {icon && <IconChip icon={icon} />}
        <div className="min-w-0 space-y-0.5">
          <h2 className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-lg font-semibold tracking-tight">
            {title}
            {badge}
          </h2>
          {description && <p className="text-sm text-pretty text-muted">{description}</p>}
        </div>
      </div>
      {href && (
        <Link
          href={href}
          className="group -mr-2 inline-flex shrink-0 items-center gap-0.5 rounded-full py-1.5 pr-2 pl-3 text-sm text-muted transition hover:bg-surface-2 hover:text-foreground"
        >
          {linkLabel}
          <ChevronRight className="size-4 transition group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );

  if (card) {
    return (
      <section className="rounded-3xl bg-surface">
        <div className="border-b border-border/70 px-5 py-4">{heading}</div>
        <div className="p-5">{children}</div>
      </section>
    );
  }
  return (
    <section className="space-y-4">
      {heading}
      {children}
    </section>
  );
}

export function ProgressBar({ value, label }: { value: number; label: string }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      className="h-2 overflow-hidden rounded-full bg-surface-3"
    >
      <div className="h-full rounded-full bg-accent transition-[width] duration-700 ease-out" style={{ width: `${value * 100}%` }} />
    </div>
  );
}

// Pulsing dot and "Live", for things that update by themselves
export function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-fill/12 px-2 py-0.5 text-xs font-medium text-accent">
      <span className="relative flex size-1.5">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60" />
        <span className="relative inline-flex size-1.5 rounded-full bg-accent" />
      </span>
      Live
    </span>
  );
}

// A row of mutually exclusive links (time range, sort order, year, ...)
export function Segmented({
  label,
  items,
}: {
  label: string;
  items: { href: string; label: ReactNode; active: boolean }[];
}) {
  return (
    <nav aria-label={label} className="inline-flex max-w-full overflow-x-auto rounded-full bg-surface p-1 [scrollbar-width:none]">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? "true" : undefined}
          scroll={false}
          className={`rounded-full px-3.5 py-1.5 text-sm whitespace-nowrap transition ${item.active ? "bg-surface-3 font-medium text-foreground" : "text-muted hover:text-foreground"}`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex animate-rise flex-col items-center gap-3 rounded-2xl bg-surface px-6 py-10 text-center">
      <IconChip icon={Icon} tone="muted" size="lg" />
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        {children && <p className="max-w-sm text-sm text-pretty text-muted">{children}</p>}
      </div>
      {action}
    </div>
  );
}

// A highlighted message across the page (import reminder, privacy hint, ...)
export function Notice({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: ComponentType<{ className?: string }>;
  title?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <aside className="flex flex-col gap-4 rounded-2xl bg-accent-fill/12 p-5 ring-1 ring-accent/20 ring-inset sm:flex-row sm:items-center">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-fill/20 text-accent">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1 space-y-0.5 text-sm leading-6">
        {title && <p className="font-medium text-foreground">{title}</p>}
        <div className="text-muted">{children}</div>
      </div>
      {action}
    </aside>
  );
}
