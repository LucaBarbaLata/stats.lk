import { Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { SpotifyLoginButton } from "@/components/spotify-button";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Log in" };

const ERRORS: Record<string, string> = {
  denied: "You cancelled the Spotify login.",
  state: "The login link expired. Try again.",
  not_allowlisted:
    "Your Spotify account isn't on this app's list of testers yet. Ask the person who invited you to add you, then try again.",
  login: "Logging in didn't work. Try again.",
};

const ACCESS = [
  "What you played recently and what's playing now",
  "Your top tracks and artists on Spotify",
  "Your name and profile picture",
];

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 sm:px-6">
      <div className="flex h-16 items-center">
        <Link href="/" aria-label="stats.lk home">
          <Logo />
        </Link>
      </div>

      <div className="flex flex-1 items-center justify-center py-16">
        <div className="w-full max-w-md space-y-8">
          <div className="space-y-3 text-center">
            <h1 className="text-[32px] leading-tight font-semibold tracking-[-0.02em]">Log in to stats.lk</h1>
            <p className="text-muted">Use your Spotify account. There&apos;s no separate password.</p>
          </div>

          <Suspense fallback={<div className="h-14 animate-pulse rounded-full bg-surface" />}>
            <LoginArea searchParams={searchParams} />
          </Suspense>

          <div className="space-y-3 rounded-2xl bg-surface p-5 text-sm">
            <p className="font-medium">stats.lk can read</p>
            <ul className="space-y-2 text-muted">
              {ACCESS.map((item) => (
                <li key={item} className="flex gap-2.5">
                  <Check className="mt-0.5 size-4 shrink-0 text-accent" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-subtle">It can&apos;t change anything in your Spotify account or see your password.</p>
          </div>

          <p className="text-center text-sm text-subtle">
            By continuing you agree to the{" "}
            <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
    </main>
  );
}

async function LoginArea({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams]);
  if (user) redirect("/dashboard");

  const error = typeof params.error === "string" ? ERRORS[params.error] : undefined;
  return (
    <div className="space-y-4">
      {params.deleted === "1" && (
        <p role="status" className="rounded-2xl bg-surface px-4 py-3 text-sm text-muted">
          Your account and all its data are deleted. To fully disconnect, also remove stats.lk from{" "}
          <a href="https://www.spotify.com/account/apps/" className="text-accent hover:underline">
            your Spotify apps
          </a>
          .
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-200 ring-1 ring-red-500/25 ring-inset">
          {error}
        </p>
      )}
      <SpotifyLoginButton />
    </div>
  );
}
