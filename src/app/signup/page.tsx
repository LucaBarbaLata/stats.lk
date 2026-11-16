import { UserRoundX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SignUpForm } from "@/components/auth-forms";
import { AuthShell, FormSkeleton, LegalNote } from "@/components/auth-shell";
import { EmptyState } from "@/components/ui";
import { signupsOpen } from "@/lib/accounts";
import { appUrl } from "@/lib/env";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Sign up" };

export default function SignUpPage() {
  return (
    <AuthShell
      title="Create your account"
      description="It's free. Upload your Spotify history and see your stats for every year you've listened."
    >
      <Suspense fallback={<FormSkeleton />}>
        <SignUpArea />
      </Suspense>

      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-accent hover:underline">
          Log in
        </Link>
      </p>

      <LegalNote doing="creating an account" />
    </AuthShell>
  );
}

async function SignUpArea() {
  if (await getCurrentUser()) redirect("/dashboard");
  if (!(await signupsOpen())) {
    return (
      <EmptyState icon={UserRoundX} title="Sign-ups are closed for now">
        stats.lk runs on one small server, so it takes a limited number of accounts. Check back later.
      </EmptyState>
    );
  }
  return <SignUpForm host={new URL(appUrl()).host} />;
}
