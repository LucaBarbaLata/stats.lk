import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";

// The frame of the login, sign-up and password pages: the logo, then one
// narrow column with a title
export function AuthShell({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 sm:px-6">
      <div className="flex h-16 items-center">
        <Link href="/" aria-label="stats.lk home">
          <Logo />
        </Link>
      </div>
      <div className="flex flex-1 items-center justify-center py-12 sm:py-16">
        <div className="w-full max-w-md space-y-8">
          <div className="space-y-3 text-center">
            <h1 className="text-[32px] leading-tight font-semibold tracking-[-0.02em] text-balance">{title}</h1>
            {description && <p className="text-pretty text-muted">{description}</p>}
          </div>
          {children}
        </div>
      </div>
    </main>
  );
}

// Holds the form's place while it loads
export function FormSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="h-12 animate-pulse rounded-xl bg-surface" />
      <div className="h-12 animate-pulse rounded-xl bg-surface" />
      <div className="h-12 animate-pulse rounded-full bg-surface" />
    </div>
  );
}

export function OrDivider() {
  return (
    <div className="flex items-center gap-4 text-xs font-medium tracking-wide text-subtle uppercase">
      <span className="h-px flex-1 bg-border" />
      or
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

export function LegalNote({ doing }: { doing: string }) {
  return (
    <p className="text-center text-sm text-subtle">
      By {doing} you agree to the{" "}
      <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">
        Terms
      </Link>{" "}
      and{" "}
      <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
        Privacy Policy
      </Link>
      .
    </p>
  );
}
