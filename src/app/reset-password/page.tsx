import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { NewPasswordForm, RequestResetForm } from "@/components/auth-forms";
import { AuthShell, FormSkeleton } from "@/components/auth-shell";
import { linkWorks } from "@/lib/accounts";

export const metadata: Metadata = { title: "Reset your password" };

// Without a token: ask for a link. With one from the email: choose a new password.
export default function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  return (
    <AuthShell title="Reset your password">
      <Suspense fallback={<FormSkeleton />}>
        <ResetArea searchParams={searchParams} />
      </Suspense>

      <p className="text-center text-sm text-muted">
        <Link href="/login" className="font-medium text-accent hover:underline">
          Back to log in
        </Link>
      </p>
    </AuthShell>
  );
}

async function ResetArea({ searchParams }: Pick<PageProps<"/reset-password">, "searchParams">) {
  const { token } = await searchParams;
  if (typeof token !== "string") return <RequestResetForm />;
  if (!(await linkWorks(token, "reset"))) {
    return (
      <div className="space-y-6">
        <p role="alert" className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-200 ring-1 ring-red-500/25 ring-inset">
          This link has expired or was already used. Links work for 1 hour. Ask for a new one below.
        </p>
        <RequestResetForm />
      </div>
    );
  }
  return <NewPasswordForm token={token} />;
}
