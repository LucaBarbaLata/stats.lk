import type { Metadata } from "next";
import Link from "next/link";
import { ContactEmail, LegalPage } from "@/components/legal";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="November 9, 2026">
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
            <strong>Your account:</strong> your email address, your username and display name, and a
            hash of your password (scrypt). The password itself is never stored.
          </li>
          <li>
            <strong>Imported history</strong>, when you upload Spotify&apos;s data export: for each play,
            the track, when it ended and how long it played. The file is read in your browser; the
            rest of its contents (searches, messages, IP addresses, devices, country and so on) is
            never sent to us.
          </li>
          <li>
            <strong>If you connect Spotify or log in with it</strong> (only invited accounts can): your
            Spotify user ID, display name and profile picture; access tokens to fetch your listening
            in the background, stored encrypted (AES-256-GCM); the tracks you play (checked every few
            minutes), what you&apos;re playing right now (checked about every 30 seconds), and your
            Spotify top tracks and artists.
          </li>
          <li>
            <strong>What you set up here:</strong> privacy settings, preferences, friends, hidden
            artists or tracks, and whether you want reminder emails.
          </li>
          <li>
            <strong>Your sessions:</strong> when you logged in and the browser you used, so you can tell
            your devices apart in Settings → Sessions.
          </li>
          <li>
            <strong>One cookie</strong> that keeps you logged in. It&apos;s strictly necessary, so
            there is no cookie banner. No analytics, tracking or advertising cookies are used.
          </li>
        </ul>
        <p className="mt-2">
          To stop people from guessing passwords, your IP address is kept in the server&apos;s memory
          for about an hour after you log in or sign up. It is never written to the database.
        </p>
      </section>

      <section>
        <h2>Emails we send</h2>
        <p>
          Only these: the link to confirm your address, password reset links you ask for, a note
          when your email changes or someone tries to sign up with it, and, if you turn it on, a
          monthly reminder to import a newer export. Every reminder has a link to stop them. No
          newsletters, and your address is never shared.
        </p>
      </section>

      <section>
        <h2>Who sees it</h2>
        <p>
          By default, only you. In settings you can share your profile with friends or with everyone
          on stats.lk, and hide specific artists or tracks from others. Your data is never sold.
        </p>
        <p className="mt-2">
          The home page shows totals across everyone, never tied to a person. Its top artists come only from
          live plays of accounts whose profile isn&apos;t private, without anything they hid.
        </p>
      </section>

      <section>
        <h2>Other services</h2>
        <ul>
          <li>
            <strong>Spotify</strong> is where your listening data comes from, through the export you
            upload or, for connected accounts, its API. Spotify&apos;s own privacy policy covers your
            Spotify account.
          </li>
          <li>
            <strong>An email provider</strong> delivers the emails above. It gets your address and
            the email, nothing else.
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
          Until you delete your account. Deleting it (Settings → Your data) removes your data
          immediately. Sign-ups whose email is never confirmed are deleted after 24 hours. Server
          backups are overwritten within 14 days.
        </p>
      </section>

      <section>
        <h2>Your rights</h2>
        <p>
          You can download all your data at any time (Settings → Your data), delete your account, and
          ask us to correct or stop using your data. We use it only to provide the service you signed
          up for. If you think we handle your data wrongly, you can contact us or complain to your data
          protection authority (in Romania, the ANSPDCP). If you connected Spotify, you can disconnect
          it in Settings → Connections, and remove stats.lk from your{" "}
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
