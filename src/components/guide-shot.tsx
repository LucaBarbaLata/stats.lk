import { existsSync } from "node:fs";
import path from "node:path";
import { ImageIcon } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";

const EXTENSIONS = ["png", "jpg", "jpeg", "webp"];

// The first public/guide/<name>.<ext> that exists, as a URL path
function findShot(name: string): string | null {
  const dir = path.join(process.cwd(), "public", "guide");
  const extension = EXTENSIONS.find((ext) => existsSync(path.join(dir, `${name}.${ext}`)));
  return extension ? `/guide/${name}.${extension}` : null;
}

// A screenshot for a guide step, framed like a browser window. Until the
// file exists in public/guide/, a placeholder says what belongs there.
export function GuideShot({ name, alt, address }: { name: string; alt: string; address?: string }) {
  const src = findShot(name);
  return (
    <Frame address={address}>
      {src ? (
        <Image src={src} alt={alt} fill sizes="(min-width: 1024px) 560px, 100vw" className="object-cover object-top" />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-subtle">
          <ImageIcon className="size-8" />
          <p className="max-w-xs text-sm">
            Screenshot coming: {alt}
            <span className="mt-1 block font-mono text-xs">public/guide/{name}.png</span>
          </p>
        </div>
      )}
    </Frame>
  );
}

// The same frame around something drawn in code instead of a screenshot
export function Frame({ address, children }: { address?: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl shadow-black/40">
      <div className="flex items-center gap-2 border-b border-border/70 px-4 py-2.5">
        <span className="flex gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-surface-3" />
          <span className="size-2.5 rounded-full bg-surface-3" />
          <span className="size-2.5 rounded-full bg-surface-3" />
        </span>
        {address && (
          <span className="ml-2 min-w-0 flex-1 truncate rounded-md bg-surface-2 px-3 py-1 text-xs text-subtle">{address}</span>
        )}
      </div>
      <div className="relative aspect-[16/10] bg-background">{children}</div>
    </div>
  );
}
