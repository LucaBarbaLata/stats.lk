import type { Metadata } from "next";
import Link from "next/link";
import { ContactEmail, LegalPage } from "@/components/legal";

export const metadata: Metadata = { title: "Terms of Use" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Use" updated="November 3, 2026">
      <section>
        <h2>The service</h2>
        <p>
          stats.lk is a free, personal, non-commercial project that shows statistics about your
          Spotify listening. It is provided as is, without any warranty. Features can change, and the
          service can be paused or shut down at any time.
        </p>
      </section>

      <section>
        <h2>Not affiliated with Spotify</h2>
        <p>
          stats.lk is not affiliated with, endorsed or sponsored by Spotify. Spotify is a trademark of
          Spotify AB. Track, artist and album names and artwork come from Spotify and belong to their
          owners; genres come from Last.fm and some pictures from Deezer.
        </p>
      </section>

      <section>
        <h2>Your account</h2>
        <ul>
          <li>You log in with your own Spotify account and are responsible for what happens with it.</li>
          <li>
            While the app is in Spotify&apos;s development mode, only a few invited accounts can use it.
          </li>
          <li>
            Your data stays yours. You can download it or delete your account at any time in settings.
          </li>
        </ul>
      </section>

      <section>
        <h2>Fair use</h2>
        <p>
          Don&apos;t try to access other people&apos;s data, overload the service, scrape it or use it
          for anything illegal. Accounts that do may be removed.
        </p>
      </section>

      <section>
        <h2>Liability</h2>
        <p>
          As far as the law allows, the operator is not liable for losses from using stats.lk, such as
          missing or wrong statistics or downtime.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          Questions: <ContactEmail />. How your data is handled is explained in the{" "}
          <Link href="/privacy" className="text-accent hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </section>
    </LegalPage>
  );
}
