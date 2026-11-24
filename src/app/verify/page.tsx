import { MailX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { VerifyForm } from "@/components/auth-forms";
import { AuthShell, FormSkeleton } from "@/components/auth-shell";
import { buttonClass, EmptyState } from "@/components/ui";
import { linkWorks } from "@/lib/accounts";

export const metadata: Metadata = { title: "Confirm your email" };

// Opened from the sign-up email, or from the one sent when an email is added
// or changed in Settings. Confirming takes the password (see verifyEmail),
// and a click, because email scanners open links on their own and would use
// the link up otherwise.
export default function VerifyPage({ searchParams }: PageProps<"/verify">) {
  return (
    <AuthShell title="Confirm your email" description="Enter your password and you're in.">
      <Suspense fallback={<FormSkeleton />}>
        <VerifyArea searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}

async function VerifyArea({ searchParams }: Pick<PageProps<"/verify">, "searchParams">) {
  const { token } = await searchParams;
  if (typeof token !== "string" || !(await linkWorks(token, "verify"))) {
    return (
      <EmptyState
        icon={MailX}
        title="This link doesn't work anymore"
        action={
          <Link href="/login" className={buttonClass("primary")}>
            Go to log in
          </Link>
        }
      >
        It expired after 24 hours or was already used. Log in, and if your email still needs confirming, you can ask
        for a new link there.
      </EmptyState>
    );
  }
  return <VerifyForm token={token} />;
}
