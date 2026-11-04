import { EyeOff, Globe, Lock, Radio, Users, UsersRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { setItemHidden } from "@/app/actions";
import { Cover } from "@/components/cover";
import { SettingsForm } from "@/components/settings-form";
import { SettingsCard } from "@/components/settings-ui";
import { buttonClass } from "@/components/ui";
import { getHiddenItems } from "@/lib/hidden";
import { requireUser } from "@/lib/session";
import { savePrivacy } from "../actions";

export const metadata: Metadata = { title: "Privacy settings" };

const VISIBILITY_OPTIONS = [
  { value: "private", label: "Only me", icon: Lock, description: "Nobody else sees your profile, plays or leaderboard spots." },
  { value: "friends", label: "Friends", icon: Users, description: "Friends see your profile, recent plays and where you rank for an artist." },
  { value: "everyone", label: "Everyone on stats.lk", icon: UsersRound, description: "Anyone logged in to stats.lk can see your profile." },
  { value: "public", label: "Public", icon: Globe, description: "Anyone with the link, even without an account. Good for sharing it anywhere." },
] as const;

const tileClass =
  "group flex cursor-pointer gap-3 rounded-2xl bg-surface p-4 ring-1 ring-border/60 transition ring-inset hover:bg-surface-2 has-checked:bg-accent-fill/10 has-checked:ring-accent/50 has-focus-visible:ring-2 has-focus-visible:ring-accent";

export default async function PrivacySettingsPage() {
  const user = await requireUser();
  const hidden = await getHiddenItems(user.id);

  return (
    <>
      <SettingsForm action={savePrivacy} title="Privacy" description="Who sees your profile, and what they see on it.">
        <fieldset className="space-y-3">
          <legend className="mb-3 font-medium">Who can see your profile</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {VISIBILITY_OPTIONS.map((option) => (
              <label key={option.value} className={tileClass}>
                <input
                  type="radio"
                  name="visibility"
                  value={option.value}
                  defaultChecked={user.visibility === option.value}
                  className="sr-only"
                />
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted transition group-has-checked:bg-accent-fill group-has-checked:text-accent-foreground">
                  <option.icon className="size-[18px]" />
                </span>
                <span className="min-w-0">
                  <span className="block font-medium">{option.label}</span>
                  <span className="block text-sm text-pretty text-muted">{option.description}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className={`${tileClass} items-center`}>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-fill/15 text-accent">
            <Radio className="size-[18px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium">Share what I&apos;m playing right now</span>
            <span className="block text-sm text-muted">People who can see your profile also see your current track, live.</span>
          </span>
          <input type="checkbox" name="showNowPlaying" defaultChecked={user.showNowPlaying} className="peer sr-only" />
          <span
            aria-hidden
            className="relative h-6 w-11 shrink-0 rounded-full bg-surface-3 transition peer-checked:bg-accent-fill after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-foreground after:shadow after:transition peer-checked:after:translate-x-5"
          />
        </label>
      </SettingsForm>

      <SettingsCard
        icon={EyeOff}
        title="Hidden from others"
        description="Hidden artists and tracks don't show up on your profile, in the friends feed, in now playing, on leaderboards or on share cards. Your own stats still include them. Hide something from its artist or track page."
      >
        {hidden.length ? (
          <ul className="-mx-2">
            {hidden.map((item) => (
              <li key={`${item.type}-${item.itemId}`} className="flex items-center gap-3 rounded-xl px-2 py-2">
                <Cover src={item.imageUrl} size={44} rounded={item.type === "artist"} label={item.name} />
                <Link href={`/${item.type}/${item.itemId}`} className="min-w-0 flex-1 hover:underline">
                  <span className="block truncate font-medium">{item.name}</span>
                  <span className="block text-sm text-muted capitalize">{item.type}</span>
                </Link>
                <form action={setItemHidden.bind(null, item.type, item.itemId, false)}>
                  <button className={buttonClass("ghost", "sm")}>Show to others</button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl bg-surface-2 px-4 py-3 text-sm text-muted">Nothing hidden.</p>
        )}
      </SettingsCard>
    </>
  );
}
