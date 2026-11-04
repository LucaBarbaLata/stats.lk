import type { Metadata } from "next";
import Link from "next/link";
import { ContactEmail, LegalPage } from "@/components/legal";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="November 3, 2026">
      <section>
        <p>
          stats.lk is a small, free and non-commercial project that shows you statistics about your
          Spotify listening. This page explains what it stores about you and why. Questions or
          requests: <ContactEmail />.
        </p>
      </section>

      <section>
        <h2>What we store</h2>
        <ul>
          <li>
            <strong>Your Spotify profile:</strong> your Spotify user ID, display name and profile
            picture, received when you log in.
          </li>
          <li>
            <strong>Spotify access tokens</strong>, so we can fetch your listening data in the
            background. They are stored encrypted (AES-256-GCM).
          </li>
          <li>
            <strong>Your listening history from Spotify:</strong> the tracks you played (checked every
            few minutes), what you&apos;re playing right now (checked about every 30 seconds), and
            your Spotify top tracks and artists when you view them.
          </li>
          <li>
            <strong>Imported history</strong>, if you upload Spotify&apos;s data export: for each play,
            the track, when it ended and how long it played. The file is read in your browser; the
            rest of its contents (IP addresses, devices, country and so on) is never sent to us.
          </li>
          <li>
            <strong>What you set up here:</strong> privacy settings, friends and hidden artists or
            tracks.
          </li>
          <li>
            <strong>One cookie</strong> that keeps you logged in. It&apos;s strictly necessary, so
            there is no cookie banner. No analytics, tracking or advertising cookies are used.
          </li>
        </ul>
      </section>

      <section>
        <h2>Who sees it</h2>
        <p>
          By default, only you. In settings you can share your profile with friends or with everyone
          on stats.lk, and hide specific artists or tracks from others. Your data is never sold.
        </p>
      </section>

      <section>
        <h2>Other services</h2>
        <ul>
          <li>
            <strong>Spotify</strong> is where your listening data comes from. Spotify&apos;s own privacy
            policy covers your Spotify account.
          </li>
          <li>
            <strong>Last.fm</strong> is asked for the genres of artists, by artist name only. Nothing
            about you is sent.
          </li>
          <li>
            <strong>Deezer</strong> is asked for pictures of artists and albums, by name only. Your browser
            then loads those pictures from Deezer, as it does with Spotify&apos;s.
          </li>
        </ul>
        <p className="mt-2">The app runs on a server operated by the site operator.</p>
      </section>

      <section>
        <h2>How long we keep it</h2>
        <p>
          Until you delete your account. Deleting it (Settings → Delete account) removes your data
          immediately. Server backups, if any, are overwritten within 30 days.
        </p>
      </section>

      <section>
        <h2>Your rights</h2>
        <p>
          You can download all your data at any time (Settings → Your data), delete your account, and
          ask us to correct or stop using your data. We use it only to provide the service you signed
          up for. If you think we handle your data wrongly, you can contact us or complain to your data
          protection authority (in Romania, the ANSPDCP). To disconnect stats.lk from Spotify, remove
          it from your{" "}
          <a href="https://www.spotify.com/account/apps/" target="_blank" rel="noreferrer" className="text-accent hover:underline">
            Spotify apps
          </a>
          .
        </p>
      </section>

      <section>
        <p>
          See also the <Link href="/terms" className="text-accent hover:underline">Terms of Use</Link>.
        </p>
      </section>
    </LegalPage>
  );
}
