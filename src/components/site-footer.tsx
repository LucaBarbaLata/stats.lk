import Link from "next/link";
import { LogoMark } from "@/components/logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-6 text-sm text-subtle sm:px-6">
        <p className="flex items-center gap-2">
          <LogoMark className="size-5" />
          Not affiliated with Spotify. Music data from Spotify, genres from Last.fm, some pictures from Deezer.
        </p>
        <nav aria-label="Footer" className="flex gap-5">
          <Link href="/guide" className="transition hover:text-foreground">
            Import guide
          </Link>
          <Link href="/privacy" className="transition hover:text-foreground">
            Privacy
          </Link>
          <Link href="/terms" className="transition hover:text-foreground">
            Terms
          </Link>
        </nav>
      </div>
    </footer>
  );
}
