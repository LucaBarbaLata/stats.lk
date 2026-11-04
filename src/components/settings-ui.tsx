import type { ComponentType, ReactNode } from "react";
import { IconChip } from "@/components/ui";

// Server-renderable parts of the settings pages. They take icon components as
// props, which can't cross into a client component, so they live apart from
// SettingsForm (src/components/settings-form.tsx).

// The top of a settings page: a large title, and on form pages the Save
// button. Sticks under the app header while the page scrolls.
export function SettingsHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="sticky top-16 z-10 -mt-2 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-border/60 bg-background/90 pt-2 pb-5 backdrop-blur-lg">
      <div className="min-w-0 space-y-1.5">
        <h2 className="text-[30px] leading-tight font-semibold tracking-[-0.02em] sm:text-[36px]">{title}</h2>
        {description && <p className="max-w-xl text-pretty text-muted">{description}</p>}
      </div>
      {action && <div className="flex flex-wrap items-center gap-3">{action}</div>}
    </div>
  );
}

// A titled block inside a settings page
export function SettingsCard({
  title,
  description,
  icon,
  tone,
  children,
}: {
  title: string;
  description?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  tone?: "danger";
  children: ReactNode;
}) {
  return (
    <section
      className={`space-y-5 rounded-3xl p-5 sm:p-6 ${tone === "danger" ? "bg-red-500/5 ring-1 ring-red-500/25 ring-inset" : "bg-surface"}`}
    >
      <div className="flex items-start gap-4">
        {icon && (
          <span className={tone === "danger" ? "[&>span]:bg-red-500/15 [&>span]:text-red-300" : ""}>
            <IconChip icon={icon} size="lg" />
          </span>
        )}
        <div className="min-w-0 space-y-1">
          <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
          {description && <p className="text-sm text-pretty text-muted">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

export const inputClass =
  "h-11 w-full rounded-xl bg-surface-2 px-3.5 text-foreground ring-1 ring-transparent transition ring-inset placeholder:text-subtle focus:ring-accent/60 focus:outline-none";
