import type { NextRequest } from "next/server";
import { unsubscribe } from "@/lib/reminders";

// One-click unsubscribing (RFC 8058): mail apps POST here from the
// List-Unsubscribe header of a reminder email. People who click the link in
// the email itself land on /unsubscribe instead, which asks first, because
// email scanners open links on their own.
export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  return (await unsubscribe(token))
    ? new Response("Unsubscribed", { status: 200 })
    : new Response("Invalid link", { status: 400 });
}
