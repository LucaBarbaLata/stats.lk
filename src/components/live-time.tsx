"use client";

import { useEffect, useState } from "react";
import { formatRelative } from "@/lib/format";

// "3 minutes ago" that keeps itself current, with the clock time under it.
// `initial` is the server's wording, so the first render matches.
export function LiveTime({ iso, initial, timeZone }: { iso: string; initial: string; timeZone: string }) {
  const [label, setLabel] = useState(initial);

  useEffect(() => {
    const date = new Date(iso);
    const tick = () => setLabel(formatRelative(date));
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 15_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [iso]);

  const clock = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone }).format(new Date(iso));
  return (
    <time dateTime={iso} className="flex shrink-0 flex-col items-end text-right leading-tight">
      <span className="text-sm text-muted">{label}</span>
      <span className="mt-0.5 text-xs text-subtle tabular-nums">{clock}</span>
    </time>
  );
}
