import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthShell, FormSkeleton, LegalNote, OrDivider } from "@/components/auth-shell";
import { LoginForm } from "@/components/auth-forms";
import { SpotifyLoginButton } from "@/components/spotify-button";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Log in" };

// Problems coming back from the Spotify login (src/app/api/auth/callback)
const SPOTIFY_ERRORS: Record<string, string> = {
  denied: "You cancelled the Spotify login.",
  state: "The login link expired. Try again.",
  not_allowlisted:
    "Your Spotify account isn't on this app's list of testers. Spotify login is only for invited accounts, so log in with your email instead.",
  login: "Logging in didn't work. Try again.",
};

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <AuthShell title="Log in to stats.lk" description="Welcome back. Use the email and password you signed up with.">
      <Suspense fallback={<FormSkeleton />}>
        <LoginArea searchParams={searchParams} />
      </Suspense>

      <p className="text-center text-sm text-muted">
        New to stats.lk?{" "}
        <Link href="/signup" className="font-medium text-accent hover:underline">
          Create an account
        </Link>
      </p>

      <OrDivider />

      <div className="space-y-3">
        <SpotifyLoginButton compact />
        <p className="text-center text-sm text-pretty text-subtle">
          For invited accounts with live stats. Spotify lets stats.lk connect only 5 of them.
        </p>
      </div>

      <LegalNote doing="continuing" />
    </AuthShell>
  );
}

async function LoginArea({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams]);
  if (user) redirect("/dashboard");

  const error = typeof params.error === "string" ? SPOTIFY_ERRORS[params.error] : undefined;
  return (
    <div className="space-y-4">
      {params.deleted === "1" && (
        <p role="status" className="rounded-2xl bg-surface px-4 py-3 text-sm text-muted">
          Your account and all its data are deleted. If you used Spotify to log in, also remove stats.lk from{" "}
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
      <LoginForm />
    </div>
  );
}
