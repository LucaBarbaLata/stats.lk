import { MailX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { UnsubscribeForm } from "@/components/auth-forms";
import { AuthShell, FormSkeleton } from "@/components/auth-shell";
import { buttonClass, EmptyState } from "@/components/ui";
import { unsubscribeLinkWorks } from "@/lib/reminders";

export const metadata: Metadata = { title: "Stop reminder emails", robots: { index: false } };

// Opened from the link in a reminder email. Stopping takes a click, because
// email scanners open links on their own.
export default function UnsubscribePage({ searchParams }: PageProps<"/unsubscribe">) {
  return (
    <AuthShell title="Stop reminder emails" description="The monthly email that says your stats need a new export.">
      <Suspense fallback={<FormSkeleton />}>
        <UnsubscribeArea searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}

async function UnsubscribeArea({ searchParams }: Pick<PageProps<"/unsubscribe">, "searchParams">) {
  const { token } = await searchParams;
  if (typeof token !== "string" || !unsubscribeLinkWorks(token)) {
    return (
      <EmptyState
        icon={MailX}
        title="This link doesn't work"
        action={
          <Link href="/settings/data" className={buttonClass("primary")}>
            Open your settings
          </Link>
        }
      >
        It may have been cut off when you copied it. You can also turn reminders off in Settings, under Your data.
      </EmptyState>
    );
  }
  return <UnsubscribeForm token={token} />;
}
