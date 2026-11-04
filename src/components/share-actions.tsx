"use client";

import { Download, Share2 } from "lucide-react";
import { useState } from "react";
import { buttonClass } from "@/components/ui";

// Download the card, or hand it to the phone's share sheet (Instagram,
// WhatsApp, ...) where the browser supports sharing files.
export function ShareActions({ url, filename }: { url: string; filename: string }) {
  const [status, setStatus] = useState<string | null>(null);

  async function share() {
    setStatus(null);
    try {
      const blob = await fetch(url).then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.blob();
      });
      const file = new File([blob], filename, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
      } else {
        setStatus("Sharing isn't supported in this browser. Download the image instead.");
      }
    } catch (error) {
      // Closing the share sheet throws AbortError; that's not a failure
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setStatus("Couldn't create the image. Please try again.");
      }
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={share}
          className={buttonClass("primary")}
        >
          <Share2 className="size-4" /> Share
        </button>
        <a
          href={`${url}${url.includes("?") ? "&" : "?"}download=1`}
          download={filename}
          className={buttonClass("secondary")}
        >
          <Download className="size-4" /> Download
        </a>
      </div>
      {status && (
        <p role="status" className="text-sm text-muted">
          {status}
        </p>
      )}
    </div>
  );
}
