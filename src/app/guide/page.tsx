import { CalendarClock, ExternalLink, Hourglass, Upload, Zap } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Frame, GuideShot } from "@/components/guide-shot";
import { Logo } from "@/components/logo";
import { buttonClass } from "@/components/ui";

export const metadata: Metadata = {
  title: "Get your full Spotify history",
};

const PRIVACY_URL = "https://www.spotify.com/account/privacy/";

const TIMINGS = [
  { icon: Zap, label: "2 minutes", text: "to ask Spotify" },
  { icon: Hourglass, label: "A few days", text: "for Spotify to prepare it, 30 at most" },
  { icon: Upload, label: "1 minute", text: "to upload it here" },
];

const FAQ = [
  {
    q: "Why can't stats.lk get my history by itself?",
    a: "Spotify only lets us see your last 50 plays. Your full history is only in this export, and only you can ask for it.",
  },
  {
    q: "What about the “Account data” option?",
    a: "It only covers the last year and has no track IDs, so it can't be matched to Spotify. Extended streaming history covers your whole account.",
  },
  {
    q: "Is my data safe?",
    a: "The file is read in your browser. Only the track, the time and how long you listened reach stats.lk. IP addresses and device details in the export never leave your device.",
  },
  {
    q: "Do I have to do this again later?",
    a: "No. After the import, stats.lk keeps saving your plays by itself.",
  },
];

interface Step {
  title: string;
  body: ReactNode;
  visual: ReactNode;
  action?: ReactNode;
}

const STEPS: Step[] = [
  {
    title: "Open your Spotify privacy settings",
    body: (
      <>
        Go to <span className="text-foreground">spotify.com/account/privacy</span> and log in. Use a web browser: the
        Spotify app doesn&apos;t have this option, but the website works on your phone too.
      </>
    ),
    action: (
      <a href={PRIVACY_URL} target="_blank" rel="noreferrer" className={buttonClass("primary")}>
        Open privacy settings <ExternalLink className="size-4" />
      </a>
    ),
    visual: <GuideShot name="step-1" alt="Spotify's account privacy page" address="spotify.com/account/privacy" />,
  },
  {
    title: "Scroll down to “Download your data”",
    body: "It's near the bottom of the page, under your privacy choices.",
    visual: <GuideShot name="step-2" alt="the Download your data section" address="spotify.com/account/privacy" />,
  },
  {
    title: "Tick “Extended streaming history”",
    body: "That's the one with your whole listening history. The other two options aren't needed; you can leave them unticked.",
    visual: <GuideShot name="step-3" alt="Extended streaming history ticked" address="spotify.com/account/privacy" />,
  },
  {
    title: "Click “Request data”",
    body: "Spotify confirms on the page that your request was received.",
    visual: <GuideShot name="step-4" alt="Extended streaming history ticked, above the Request data button" address="spotify.com/account/privacy" />,
  },
  {
    title: "Confirm the email from Spotify",
    body: "Spotify sends you an email right away. Open it and click Confirm within 14 days: the request doesn't start until you do.",
    visual: <GuideShot name="step-5" alt="Spotify's confirmation email" address="Your inbox" />,
  },
  {
    title: "Wait for Spotify",
    body: "Spotify says it can take up to 30 days, but it's usually a few days. Nothing is lost meanwhile: stats.lk keeps saving everything you play.",
    visual: (
      <Frame address="Meanwhile">
        <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-accent-fill/15 text-accent">
            <CalendarClock className="size-8" />
          </span>
          <p className="text-lg font-semibold">Usually a few days</p>
          <p className="max-w-xs text-sm text-muted">Keep listening. Your plays are saved here every few minutes.</p>
        </div>
      </Frame>
    ),
  },
  {
    title: "Download the ZIP",
    body: (
      <>
        When it&apos;s ready, Spotify emails you a download link. Download{" "}
        <code className="rounded-md bg-surface-2 px-1.5 py-0.5 text-sm text-foreground">my_spotify_data.zip</code> within
        14 days; after that the link stops working.
      </>
    ),
    visual: <GuideShot name="step-7" alt="the email with the download link" address="Your inbox" />,
  },
  {
    title: "Upload it to stats.lk",
    body: "No need to unzip it. Your stats go back to your very first play a moment later.",
    action: (
      <Link href="/import" className={buttonClass("primary")}>
        <Upload className="size-4" /> Go to import
      </Link>
    ),
    visual: (
      <Frame address="stats.lk/import">
        <div className="flex h-full items-center justify-center p-6">
          <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-border-strong bg-surface px-6 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-accent-fill/20 text-accent">
              <Upload className="size-5" />
            </span>
            <span className="font-medium">Choose my_spotify_data.zip</span>
            <span className="text-sm text-muted">Or the JSON files from inside it</span>
          </div>
        </div>
      </Frame>
    ),
  },
];

export default function GuidePage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label="stats.lk home">
            <Logo />
          </Link>
          <Link href="/dashboard" className={buttonClass("ghost", "sm")}>
            Back to your stats
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6">
        <section className="grid grid-cols-1 gap-10 pt-14 pb-16 lg:grid-cols-[1.1fr_1fr] lg:items-end lg:pt-20">
          <div className="space-y-5">
            <p className="text-sm font-medium text-accent">Import guide</p>
            <h1 className="text-[40px] leading-[1.05] font-semibold tracking-[-0.03em] text-balance sm:text-[56px]">
              Get your full Spotify history
            </h1>
            <p className="max-w-xl text-lg text-pretty text-muted">
              Spotify only lets us see your last 50 plays. To get stats from the day you made your
              account, ask Spotify for a copy of your listening history and upload it here.
            </p>
          </div>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {TIMINGS.map(({ icon: Icon, label, text }) => (
              <li key={label} className="flex items-center gap-4 rounded-2xl bg-surface p-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-fill/15 text-accent">
                  <Icon className="size-5" />
                </span>
                <span>
                  <span className="block font-semibold">{label}</span>
                  <span className="block text-sm text-muted">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <ol className="space-y-20 border-t border-border/60 py-16 lg:space-y-28 lg:py-24">
          {STEPS.map((step, index) => (
            <li key={step.title} className="grid grid-cols-1 items-center gap-8 lg:grid-cols-2 lg:gap-16">
              <div className={`space-y-4 ${index % 2 ? "lg:order-2" : ""}`}>
                <span className="flex size-10 items-center justify-center rounded-full bg-accent-fill text-base font-semibold text-accent-foreground tabular-nums">
                  {index + 1}
                </span>
                <h2 className="text-[26px] leading-tight font-semibold tracking-[-0.02em] text-balance sm:text-[30px]">
                  {step.title}
                </h2>
                <p className="max-w-lg text-lg text-pretty text-muted">{step.body}</p>
                {step.action && <div className="pt-2">{step.action}</div>}
              </div>
              <div className={index % 2 ? "lg:order-1" : ""}>{step.visual}</div>
            </li>
          ))}
        </ol>

        <section className="grid grid-cols-1 gap-10 border-t border-border/60 py-16 lg:grid-cols-[1fr_2fr]">
          <h2 className="text-[30px] leading-tight font-semibold tracking-[-0.02em]">Questions</h2>
          <dl className="grid grid-cols-1 gap-x-10 gap-y-8 sm:grid-cols-2">
            {FAQ.map((item) => (
              <div key={item.q} className="space-y-2">
                <dt className="font-medium">{item.q}</dt>
                <dd className="text-pretty text-muted">{item.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>
    </div>
  );
}
