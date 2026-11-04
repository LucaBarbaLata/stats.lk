import { ChartColumn, Check, Clock3, Gift, History, Share2, Trophy, Users, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { Accordion } from "@/components/accordion";
import { ArtistImage, HeatmapPreview, HoursPreview, Panel, previewArtists, TopPreview } from "@/components/landing";
import { Logo } from "@/components/logo";
import { CountUp, InView, Reveal } from "@/components/motion";
import { TrophyBadge } from "@/components/trophies";
import { buttonClass } from "@/components/ui";
import { getCommunityStats } from "@/lib/community";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = {
  title: { absolute: "stats.lk: your Spotify stats, all of them, free" },
};

const INCLUDED = [
  "Plays and minutes for every track, artist and album",
  "Lifetime stats from your imported history",
  "Any time range, down to the day",
  "Listening by hour, weekday and month",
  "Friends, live listening and taste match",
  "Levels and 20 trophies to earn",
  "Wrapped for any year, any day",
  "Export or delete your data any time",
];

const FAQ = [
  {
    q: "Is it really free?",
    a: "Yes. There's no paid plan and nothing is locked. stats.lk is a personal project, not a business.",
  },
  {
    q: "What do you do with my data?",
    a: "Show it to you, and to friends if you choose to share. It's never sold, there are no ads, and you can download or delete everything in settings.",
  },
  {
    q: "Why can't everyone sign up yet?",
    a: "Spotify limits new apps to a handful of invited accounts. Until that changes, ask the person who runs this site to add you.",
  },
  {
    q: "How do I get stats from before I joined?",
    a: "Spotify only lets us see your last 50 plays. Request your extended streaming history from Spotify once, upload it here, and your stats go back to your first play.",
  },
  {
    q: "Where do the numbers on this page come from?",
    a: "From everyone on stats.lk together, updated every hour. They never show one person's listening, and leave out anything people hid.",
  },
  {
    q: "Is this made by Spotify?",
    a: "No. stats.lk uses Spotify's public API with your permission and isn't affiliated with Spotify.",
  },
];

// Wait for a request (and real data) instead of baking numbers in at build time
async function communityStats() {
  await connection();
  return getCommunityStats().catch(() => null);
}

const onView = "[animation-play-state:paused] group-data-[inview=true]/view:[animation-play-state:running]";

export default function LandingPage() {
  return (
    <div className="flex flex-1 flex-col overflow-x-clip">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-6 px-4 sm:px-6">
          <Link href="/" aria-label="stats.lk home">
            <Logo />
          </Link>
          <nav aria-label="Page" className="hidden items-center gap-6 text-sm text-muted md:flex">
            <a href="#features" className="transition hover:text-foreground">
              Features
            </a>
            <a href="#free" className="transition hover:text-foreground">
              What&apos;s free
            </a>
            <a href="#faq" className="transition hover:text-foreground">
              FAQ
            </a>
          </nav>
          <Suspense fallback={<div className="h-8 w-28 rounded-full bg-surface" />}>
            <HeaderActions />
          </Suspense>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6">
        <section className="grid grid-cols-1 items-center gap-14 pt-16 pb-20 lg:grid-cols-[1.05fr_1fr] lg:pt-24">
          <div className="space-y-7">
            <h1 className="text-[44px] leading-[1.02] font-semibold tracking-[-0.035em] text-balance sm:text-[64px]">
              <span className="block animate-rise">Every play counted.</span>
              <span className="block animate-rise" style={{ animationDelay: "120ms" }}>
                Every stat free.
              </span>
            </h1>
            <p className="max-w-lg animate-rise text-lg text-pretty text-muted" style={{ animationDelay: "240ms" }}>
              stats.lk turns your Spotify listening into top lists, streaks, trophies and a Wrapped you
              can open any day of the year. No subscription, nothing locked.
            </p>
            <div className="flex animate-rise flex-wrap items-center gap-3" style={{ animationDelay: "360ms" }}>
              <Link href="/login" className={`${buttonClass("primary")} h-12 px-6 text-base`}>
                Get started
              </Link>
              <a href="#features" className={`${buttonClass("ghost")} h-12 px-5 text-base`}>
                See what&apos;s inside
              </a>
            </div>
            <p className="animate-rise text-sm text-subtle" style={{ animationDelay: "480ms" }}>
              Works with your Spotify account. Not affiliated with Spotify.
            </p>
          </div>

          <div aria-hidden className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div className="absolute -inset-10 -z-10 animate-glow rounded-full bg-accent-fill/15 blur-3xl" />
            <Suspense fallback={<HeroSkeleton />}>
              <HeroPreview />
            </Suspense>
          </div>
        </section>

        <Suspense fallback={<div className="h-[148px]" />}>
          <TotalsStrip />
        </Suspense>

        <section id="free" className="scroll-mt-24 space-y-8 border-t border-border/60 py-20">
          <div className="max-w-2xl space-y-3">
            <h2 className="text-[32px] leading-tight font-semibold tracking-[-0.02em] text-balance">
              The things other apps charge for are just part of it here
            </h2>
            <p className="text-muted">No trial, no plus plan, no blurred-out numbers.</p>
          </div>
          <InView threshold={0.2}>
            <ul className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
              {INCLUDED.map((item, index) => (
                <li key={item} className={`flex animate-rise gap-3 ${onView}`} style={{ animationDelay: `${index * 70}ms` }}>
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-accent-fill text-accent-foreground">
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </InView>
        </section>

        <div id="features" className="scroll-mt-24 space-y-28 border-t border-border/60 py-24">
          <Feature
            icon={ChartColumn}
            title="Top lists with the numbers that matter"
            text="Tracks, artists, albums and genres for the last month, the last year, all time or any dates you pick. Every row shows how many times you played it and for how long."
            preview={
              <Suspense fallback={<Panel className="h-72" />}>
                <TopListFeaturePreview />
              </Suspense>
            }
          />
          <Feature
            reverse
            icon={Clock3}
            title="See when you listen, not just what"
            text="A year of listening days at a glance, your streaks, the hours you play most and how this month compares with the last."
            preview={
              <Suspense fallback={<Panel className="h-72" />}>
                <ActivityFeaturePreview />
              </Suspense>
            }
          />
          <Feature
            icon={History}
            title="Your whole history, from your first play"
            text="Spotify only lets us see your last 50 plays. Ask Spotify for your data once, drop the file here, and every stat goes back years. The file is read in your browser; only tracks and times are kept."
            preview={
              <InView>
                <Panel>
                  <ol className="space-y-4">
                    {["Request your data from Spotify", "Get the email with your files", "Upload the ZIP to stats.lk"].map((step, index) => (
                      <li key={step} className={`flex animate-rise items-center gap-4 ${onView}`} style={{ animationDelay: `${index * 160}ms` }}>
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-fill/15 text-sm font-semibold text-accent">
                          {index + 1}
                        </span>
                        <span className="font-medium">{step}</span>
                      </li>
                    ))}
                  </ol>
                </Panel>
              </InView>
            }
          />
          <Feature
            reverse
            icon={Users}
            title="Friends, live"
            text="See what your friends are playing right now, how well your tastes match and who listens to an artist the most. You decide who sees your profile, and can hide any artist or track."
            preview={
              <Suspense fallback={<Panel className="h-56" />}>
                <FriendsFeaturePreview />
              </Suspense>
            }
          />
          <Feature
            icon={Gift}
            title="Wrapped whenever you want it"
            text="Your year in music, ready any day: minutes, top artist, top tracks, busiest month and longest streak. Turn it into an image for your story in one tap."
            preview={
              <Suspense fallback={<div className="mx-auto h-96 w-60 rounded-[28px] bg-surface" />}>
                <WrappedFeaturePreview />
              </Suspense>
            }
          />
          <Feature
            reverse
            icon={Trophy}
            title="Levels and trophies"
            text="Listening earns you levels, from bedroom listener to legend, plus trophies for night owls, marathon days, deep album dives and the artists you never skip."
            preview={
              <InView>
                <Panel className="grid grid-cols-3 gap-3">
                  {(
                    [
                      { label: "Night owl", icon: "moon", tier: 3 },
                      { label: "Marathon", icon: "timer", tier: 2 },
                      { label: "Loyal fan", icon: "heart", tier: 3 },
                      { label: "Explorer", icon: "compass", tier: 1 },
                      { label: "Time traveller", icon: "hourglass", tier: 2 },
                      { label: "Album diver", icon: "disc", tier: 0 },
                    ] as const
                  ).map((trophy, index) => (
                    <div
                      key={trophy.label}
                      className={`flex animate-pop flex-col items-center gap-2 rounded-2xl bg-surface-2 p-3 text-center ${onView}`}
                      style={{ animationDelay: `${index * 90}ms` }}
                    >
                      <TrophyBadge icon={trophy.icon} tier={trophy.tier} size={48} />
                      <span className="text-xs font-medium">{trophy.label}</span>
                    </div>
                  ))}
                </Panel>
              </InView>
            }
          />
        </div>

        <section id="faq" className="scroll-mt-24 grid grid-cols-1 gap-10 border-t border-border/60 py-20 lg:grid-cols-[1fr_2fr]">
          <h2 className="text-[32px] leading-tight font-semibold tracking-[-0.02em]">Questions</h2>
          <Reveal>
            <Accordion items={FAQ} />
          </Reveal>
        </section>

        <section className="mb-20 flex flex-col items-start gap-6 rounded-3xl bg-surface p-8 sm:flex-row sm:items-center sm:justify-between sm:p-10">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight">See your own numbers</h2>
            <p className="text-muted">It takes one click with your Spotify account.</p>
          </div>
          <Link href="/login" className={`${buttonClass("primary")} h-12 px-6 text-base`}>
            Get started
          </Link>
        </section>
      </main>
    </div>
  );
}

async function HeaderActions() {
  const user = await getCurrentUser();
  if (user) {
    return (
      <Link href="/dashboard" className={buttonClass("primary", "sm")}>
        Open your stats
      </Link>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <Link href="/login" className={buttonClass("ghost", "sm")}>
        Log in
      </Link>
      <Link href="/login" className={buttonClass("primary", "sm")}>
        Get started
      </Link>
    </div>
  );
}

function HeroSkeleton() {
  return (
    <div className="space-y-4">
      <Panel className="h-72" />
      <Panel className="ml-auto h-40 w-[78%]" />
    </div>
  );
}

async function HeroPreview() {
  const stats = await communityStats();
  const artists = previewArtists(stats);
  const minutes = Math.round(stats?.minutesLast7Days ?? 1482);
  const previous = stats?.minutesPrevious7Days ?? 1256;
  const change = previous > 0 ? Math.round(((minutes - previous) / previous) * 100) : null;

  return (
    <>
      <Panel className="relative z-10 animate-rise pb-10" style={{ animationDelay: "250ms" }}>
        <div className="mb-4 flex items-baseline justify-between">
          <p className="font-semibold">Top artists on stats.lk</p>
          <p className="text-sm text-subtle">Last 30 days</p>
        </div>
        <TopPreview rows={artists.slice(0, 4)} start={550} />
      </Panel>
      <div className="relative z-20 -mt-4 ml-auto w-[78%] animate-float sm:-mt-6">
        <Panel className="animate-rise" style={{ animationDelay: "500ms" }}>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm text-muted">Listened this week</p>
              <p className="text-[34px] leading-none font-semibold tracking-tight">
                <CountUp value={minutes} delay={700} /> min
              </p>
            </div>
            {change !== null && (
              <p className="rounded-full bg-accent-fill/15 px-2.5 py-1 text-xs font-medium text-accent">
                {change >= 0 ? "↑" : "↓"} {Math.abs(change)}%
              </p>
            )}
          </div>
          <div className="mt-4 overflow-hidden">
            <HeatmapPreview stats={stats} weeks={17} start={700} />
          </div>
        </Panel>
      </div>
    </>
  );
}

async function TotalsStrip() {
  const stats = await communityStats();
  if (!stats || stats.totals.plays === 0) return null;
  const items = [
    { value: stats.totals.plays, label: "plays counted" },
    { value: Math.round(stats.totals.minutes), label: "minutes of music" },
    { value: stats.totals.artists, label: "different artists" },
  ];
  return (
    <section aria-label="stats.lk in numbers" className="grid grid-cols-1 gap-3 pb-20 sm:grid-cols-3">
      {items.map((item, index) => (
        <div key={item.label} className="rounded-3xl bg-surface p-6">
          <p className="text-[40px] leading-none font-semibold tracking-tight">
            <CountUp value={item.value} delay={index * 150} />
          </p>
          <p className="mt-2 text-muted">{item.label} on stats.lk so far</p>
        </div>
      ))}
    </section>
  );
}

async function TopListFeaturePreview() {
  const stats = await communityStats();
  return (
    <InView>
      <Panel>
        <TopPreview rows={previewArtists(stats).slice(0, 5)} onView />
      </Panel>
    </InView>
  );
}

async function ActivityFeaturePreview() {
  const stats = await communityStats();
  return (
    <InView>
      <Panel className="space-y-5">
        <div className="overflow-hidden">
          <HeatmapPreview stats={stats} weeks={22} onView />
        </div>
        <HoursPreview stats={stats} onView />
      </Panel>
    </InView>
  );
}

async function FriendsFeaturePreview() {
  const stats = await communityStats();
  const [first, second] = previewArtists(stats);
  return (
    <InView>
      <Panel className="space-y-4">
        <div className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
          <ArtistImage artist={first} size={48} />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-sm text-muted">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-accent" />
              </span>
              A friend is listening to
            </p>
            <p className="truncate font-semibold">{first.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-5 rounded-2xl bg-accent-fill/10 p-4">
          <p className="text-[44px] leading-none font-semibold tracking-tight">
            <CountUp value={81} />%
          </p>
          <p className="text-sm text-muted">
            taste match. You both play {first.name} and {second?.name ?? first.name}.
          </p>
        </div>
      </Panel>
    </InView>
  );
}

async function WrappedFeaturePreview() {
  const stats = await communityStats();
  const year = stats?.thisYear.year ?? new Date().getFullYear();
  const minutes = Math.round(stats?.thisYear.minutes || 24310);
  const top = previewArtists(stats)[0];
  const topArtist = stats?.thisYear.topArtist ? { ...top, ...stats.thisYear.topArtist } : top;
  return (
    <div className="flex justify-center">
      <div className="w-60 animate-float rounded-[28px] bg-gradient-to-b from-[#0f3d22] to-background p-5 shadow-2xl shadow-black/50 ring-1 ring-border">
        <p className="text-sm text-accent">stats.lk</p>
        <p className="mt-6 text-xl font-semibold">{year} on stats.lk</p>
        <p className="mt-6 text-[44px] leading-none font-semibold tracking-tight">
          <CountUp value={minutes} />
        </p>
        <p className="text-sm text-muted">minutes listened</p>
        <div className="mt-6 flex items-center gap-3">
          <ArtistImage artist={topArtist} size={44} />
          <div className="min-w-0">
            <p className="text-xs text-accent">Top artist</p>
            <p className="truncate font-semibold">{topArtist.name}</p>
          </div>
        </div>
        <div className="mt-5 flex items-center gap-2 text-xs text-subtle">
          <Share2 className="size-3.5" /> Share to your story
        </div>
      </div>
    </div>
  );
}

function Feature({
  title,
  text,
  preview,
  icon: Icon,
  reverse,
}: {
  title: string;
  text: string;
  preview: ReactNode;
  icon?: LucideIcon;
  reverse?: boolean;
}) {
  return (
    <section className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
      <Reveal className={`max-w-lg space-y-4 ${reverse ? "lg:order-2" : ""}`}>
        {Icon && (
          <span className="flex size-12 items-center justify-center rounded-full bg-accent-fill/15 text-accent">
            <Icon className="size-5" />
          </span>
        )}
        <h2 className="text-[30px] leading-tight font-semibold tracking-[-0.02em] text-balance">{title}</h2>
        <p className="text-lg text-pretty text-muted">{text}</p>
      </Reveal>
      <div aria-hidden className={reverse ? "lg:order-1" : ""}>
        {preview}
      </div>
    </section>
  );
}
