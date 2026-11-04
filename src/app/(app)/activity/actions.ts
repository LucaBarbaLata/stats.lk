"use server";

import { appTimezone } from "@/lib/env";
import { getCurrentUser } from "@/lib/session";
import { getPlaysOnDay, type DayPlay } from "@/lib/stats";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

// Called when a day on the activity heatmap is opened
export async function loadDayPlays(day: unknown): Promise<DayPlay[]> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not logged in");
  if (typeof day !== "string" || !DAY.test(day)) throw new Error("Invalid day");
  // An action runs outside the render that sets the user's time zone for
  // appTimezone(), so it has to be passed along
  return getPlaysOnDay(user.id, day, user.timezone ?? appTimezone());
}
