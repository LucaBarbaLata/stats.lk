import { ExternalLink } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";
import { Cover } from "@/components/cover";
import { buttonClass } from "@/components/ui";

// Top of an artist, track or album page. The cover, blurred, tints the
// header behind it.
export function DetailHeader({
  kind,
  title,
  imageUrl,
  rounded,
  spotifyUrl,
  actions,
  children,
}: {
  kind: string;
  title: string;
  imageUrl: string | null;
  rounded?: boolean;
  spotifyUrl: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="relative isolate overflow-hidden rounded-3xl bg-surface p-5 sm:p-8">
      {imageUrl && (
        <Image
          src={imageUrl}
          alt=""
          fill
          unoptimized
          aria-hidden
          className="-z-10 scale-125 object-cover opacity-30 blur-3xl saturate-150"
        />
      )}
      <div className="-z-10 absolute inset-0 bg-gradient-to-t from-surface via-surface/70 to-transparent" />
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
        <div className="w-40 shrink-0 shadow-2xl shadow-black/50 sm:w-48" style={{ borderRadius: rounded ? "9999px" : "0.75rem" }}>
          <Cover src={imageUrl} size={192} rounded={rounded} label={title} />
        </div>
        <div className="min-w-0 space-y-3">
          <p className="text-sm font-medium text-muted">{kind}</p>
          <h1 className="text-[32px] leading-[1.05] font-semibold tracking-[-0.02em] break-words text-balance sm:text-5xl">
            {title}
          </h1>
          {children}
          <div className="flex flex-wrap gap-2 pt-1">
            <a href={spotifyUrl} target="_blank" rel="noreferrer" className={buttonClass("secondary", "sm")}>
              <ExternalLink className="size-4" /> Open in Spotify
            </a>
            {actions}
          </div>
        </div>
      </div>
    </header>
  );
}
