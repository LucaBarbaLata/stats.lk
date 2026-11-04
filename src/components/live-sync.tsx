"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { syncNow } from "@/app/actions";

const INTERVAL_MS = 45_000;
// Spotify lists a track as played a few seconds after the next one starts
const AFTER_TRACK_CHANGE_MS = 8_000;

// Sent by the now playing card when the track changes
export const TRACK_CHANGE_EVENT = "statslk:track-change";

// Pulls the latest plays from Spotify when the app opens, every 45 seconds
// while it's on screen and shortly after the playing track changes. The page
// re-renders when a newer play turns up, whether this sync or the worker
// saved it.
export function LiveSync() {
  const router = useRouter();

  useEffect(() => {
    let latest: number | null = null;
    let busy = false;
    let pending: ReturnType<typeof setTimeout> | undefined;

    const sync = () => {
      if (busy || document.visibilityState !== "visible") return;
      busy = true;
      syncNow()
        .then((result) => {
          const newer = latest !== null && result.latestMs !== null && result.latestMs > latest;
          if (result.added > 0 || newer) router.refresh();
          latest = result.latestMs;
        })
        .catch(() => {})
        .finally(() => {
          busy = false;
        });
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") sync();
    };
    const onTrackChange = () => {
      clearTimeout(pending);
      pending = setTimeout(sync, AFTER_TRACK_CHANGE_MS);
    };

    sync();
    const timer = setInterval(sync, INTERVAL_MS);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(TRACK_CHANGE_EVENT, onTrackChange);
    return () => {
      clearInterval(timer);
      clearTimeout(pending);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(TRACK_CHANGE_EVENT, onTrackChange);
    };
  }, [router]);

  return null;
}
