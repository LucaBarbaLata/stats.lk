import { redirect } from "next/navigation";
import { today } from "@/lib/dates";
import { requireUser } from "@/lib/session";

// Wrapped for the current year
export default async function WrappedIndexPage() {
  await requireUser();
  redirect(`/wrapped/${today().slice(0, 4)}`);
}
