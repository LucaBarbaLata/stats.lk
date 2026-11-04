"use client";

import { unzip } from "fflate";
import { Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ProgressBar } from "@/components/ui";
import {
  ACCOUNT_FILE_PATTERN,
  EXTENDED_FILE_PATTERN,
  IMPORT_CHUNK_SIZE,
  parseHistory,
  type ImportRow,
} from "@/lib/import/parse";
import { importChunk } from "./actions";

type Status =
  | { step: "idle" }
  | { step: "reading" }
  | { step: "uploading"; sent: number; total: number }
  | { step: "done"; added: number; merged: number; total: number }
  | { step: "error"; message: string; showGuide?: boolean };

class ImportError extends Error {
  constructor(
    message: string,
    readonly showGuide = false,
  ) {
    super(message);
  }
}

function unzipHistory(file: File): Promise<Record<string, Uint8Array>> {
  return file.arrayBuffer().then(
    (buffer) =>
      new Promise((resolve, reject) => {
        unzip(
          new Uint8Array(buffer),
          {
            filter: (entry) =>
              EXTENDED_FILE_PATTERN.test(entry.name) || ACCOUNT_FILE_PATTERN.test(entry.name),
          },
          (error, files) => (error ? reject(new ImportError("Couldn't open this ZIP file.")) : resolve(files)),
        );
      }),
  );
}

// Reads the selected ZIP and/or JSON files into rows, entirely in the browser.
async function readFiles(files: File[]): Promise<ImportRow[]> {
  const decoder = new TextDecoder();
  const contents: string[] = [];
  let sawAccountData = false;

  for (const file of files) {
    if (file.name.toLowerCase().endsWith(".zip")) {
      for (const [name, data] of Object.entries(await unzipHistory(file))) {
        if (EXTENDED_FILE_PATTERN.test(name)) contents.push(decoder.decode(data));
        else sawAccountData = true;
      }
    } else {
      contents.push(await file.text());
    }
  }

  const rows: ImportRow[] = [];
  for (const text of contents) {
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      throw new ImportError("One of the files isn't valid JSON.");
    }
    const parsed = parseHistory(data);
    if (parsed.kind === "account") sawAccountData = true;
    rows.push(...parsed.rows);
  }

  if (!rows.length) {
    if (sawAccountData) {
      throw new ImportError(
        "This is Spotify's \"Account data\" export, which only covers the last year and has no track IDs. Request \"Extended streaming history\" instead.",
        true,
      );
    }
    throw new ImportError(
      "No plays found. Pick the my_spotify_data.zip file, or the Streaming_History_Audio JSON files inside it.",
      true,
    );
  }
  return rows;
}

export function ImportForm() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ step: "idle" });
  const busy = status.step === "reading" || status.step === "uploading";

  async function handleFiles(fileList: FileList | null) {
    const files = [...(fileList ?? [])];
    if (!files.length) return;
    setStatus({ step: "reading" });
    try {
      const rows = await readFiles(files);
      let added = 0;
      let merged = 0;
      for (let i = 0; i < rows.length; i += IMPORT_CHUNK_SIZE) {
        setStatus({ step: "uploading", sent: i, total: rows.length });
        const result = await importChunk(rows.slice(i, i + IMPORT_CHUNK_SIZE));
        if ("error" in result) throw new ImportError(result.error);
        added += result.added;
        merged += result.merged;
      }
      setStatus({ step: "done", added, merged, total: rows.length });
      router.refresh();
    } catch (error) {
      setStatus({
        step: "error",
        message:
          error instanceof ImportError ? error.message : "Something went wrong while importing. Please try again.",
        showGuide: error instanceof ImportError && error.showGuide,
      });
    }
  }

  return (
    <div className="space-y-4">
      <label
        className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border-strong bg-surface px-6 py-12 text-center transition hover:border-accent/60 hover:bg-surface-2 ${busy ? "pointer-events-none opacity-60" : ""}`}
      >
        <span className="flex size-12 items-center justify-center rounded-full bg-accent-fill/20 text-accent">
          <Upload className="size-5" />
        </span>
        <span className="font-medium">Choose my_spotify_data.zip</span>
        <span className="text-sm text-muted">
          Or the Streaming_History_Audio_*.json files from inside it
        </span>
        <input
          type="file"
          accept=".zip,.json,application/zip,application/json"
          multiple
          disabled={busy}
          className="sr-only"
          onChange={(event) => {
            handleFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </label>

      <div aria-live="polite">
        {status.step === "reading" && <p className="animate-pulse text-sm text-muted">Reading your files…</p>}
        {status.step === "uploading" && (
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <p className="text-muted">
                Saving {status.sent.toLocaleString("en-US")} of {status.total.toLocaleString("en-US")} plays. Keep this
                tab open.
              </p>
              <p className="font-semibold tabular-nums">{Math.floor((status.sent / status.total) * 100)}%</p>
            </div>
            <ProgressBar value={status.sent / status.total} label="Plays saved" />
          </div>
        )}
        {status.step === "done" && (
          <p className="rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100 ring-1 ring-emerald-500/25 ring-inset">
            Done! {status.added.toLocaleString("en-US")} new plays added
            {status.merged > 0 && `, ${status.merged.toLocaleString("en-US")} matched with plays we already had`}.
            {status.total - status.added - status.merged > 0 &&
              ` ${(status.total - status.added - status.merged).toLocaleString("en-US")} were already imported.`}
          </p>
        )}
        {status.step === "error" && (
          <p role="alert" className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-200 ring-1 ring-red-500/25 ring-inset">
            {status.message}{" "}
            {status.showGuide && (
              <Link href="/guide" className="underline">
                See the guide
              </Link>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
