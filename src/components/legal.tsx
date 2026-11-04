import Link from "next/link";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { Logo } from "@/components/logo";
import { contactEmail } from "@/lib/env";

// Shared layout for the privacy and terms pages
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-2xl space-y-8 px-4 pb-16 sm:px-6">
      <div className="flex h-16 items-center">
        <Link href="/" aria-label="stats.lk home">
          <Logo />
        </Link>
      </div>
      <header className="space-y-2 pt-4">
        <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.02em] sm:text-[34px]">{title}</h1>
        <p className="text-sm text-muted">Last updated {updated}</p>
      </header>
      <div className="space-y-8 leading-7 text-muted [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-foreground">
        {children}
      </div>
    </main>
  );
}

async function Email() {
  // Read at request time: the Docker image is built without the .env values
  await connection();
  const email = contactEmail();
  return email ? (
    <a href={`mailto:${email}`} className="text-accent hover:underline">
      {email}
    </a>
  ) : (
    <>the operator of this site</>
  );
}

export function ContactEmail() {
  return (
    <Suspense fallback={<>the operator of this site</>}>
      <Email />
    </Suspense>
  );
}
