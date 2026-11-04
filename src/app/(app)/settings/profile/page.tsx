import { ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Cover } from "@/components/cover";
import { CountedField, UsernameField } from "@/components/profile-fields";
import { SettingsForm } from "@/components/settings-form";
import { SpotifyIcon } from "@/components/spotify-button";
import { appUrl } from "@/lib/env";
import { BIO_MAX, DISPLAY_NAME_MAX } from "@/lib/profile";
import { requireUser } from "@/lib/session";
import { saveProfile } from "../actions";

export const metadata: Metadata = { title: "Profile settings" };

export default async function ProfileSettingsPage() {
  const user = await requireUser();
  const host = new URL(appUrl()).host;

  return (
    <SettingsForm
      action={saveProfile}
      title="Profile"
      description={
        <>
          How you show up to friends on stats.lk.{" "}
          <Link href={`/u/${user.username}`} className="inline-flex items-center gap-0.5 text-accent hover:underline">
            View your profile <ArrowUpRight className="size-3.5" />
          </Link>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-10">
        <div className="flex flex-col items-center gap-3 sm:pt-7">
          <div className="relative w-32 animate-pop">
            <Cover src={user.avatarUrl} size={128} rounded label={user.displayName} />
            <span
              title="Picture from Spotify"
              className="absolute right-0.5 bottom-0.5 flex size-9 items-center justify-center rounded-full bg-[#1DB954] text-black ring-4 ring-background"
            >
              <SpotifyIcon className="size-5" />
            </span>
          </div>
          <p className="max-w-36 text-center text-xs text-subtle">Your picture comes from Spotify and updates when you log in.</p>
        </div>

        <div className="space-y-6">
          <CountedField
            label="Display name"
            name="displayName"
            defaultValue={user.displayName}
            max={DISPLAY_NAME_MAX}
            hint={user.customDisplayName ? "Logging in no longer changes it." : "Taken from Spotify until you change it."}
          />
          <UsernameField host={host} defaultValue={user.username} />
        </div>
      </div>

      <CountedField
        label="Bio"
        name="bio"
        defaultValue={user.bio ?? ""}
        max={BIO_MAX}
        multiline
        placeholder="A line about your taste in music"
        hint="Shown on your profile to everyone who can see it."
      />
    </SettingsForm>
  );
}
