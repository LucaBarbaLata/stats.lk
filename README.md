# stats.lk

Spotify listening stats with every feature free. Next.js web app, a background
worker that saves your plays, and PostgreSQL.

## How data gets in

- **Login:** Spotify only exposes your last 50 plays. They are saved right away.
- **Worker:** fetches every user's recently played tracks every few minutes
  (`SYNC_INTERVAL_MINUTES`), and again whenever the app is opened. It also
  refreshes what everyone is playing right now every 30 seconds.
- **Import:** your full history from Spotify's "Extended streaming history" export
  (`/guide` explains how to get it, `/import` uploads it). The ZIP is parsed in the
  browser; the worker then looks up the imported tracks on Spotify.

## Genres

Spotify returns empty genres, so artist genres come from Last.fm tags, filtered
to real genres (`src/lib/lastfm.ts`). Get a free API key at
<https://www.last.fm/api/account/create> and set `LASTFM_API_KEY`; without it,
genres are skipped.

## Admin and legal

- `ADMIN_SPOTIFY_IDS` (comma-separated Spotify user IDs) can open `/admin`: worker
  health, users, sync errors, metadata backlog and database size.
- `CONTACT_EMAIL` is shown on `/privacy` and `/terms`.
- Users can export their data (CSV/JSON) and delete their account in `/settings`.

## Spotify limits (Development Mode, since February 2026)

- Max **5 users**, each added by hand under *User Management* in the Spotify dashboard.
- The app owner needs **Spotify Premium**, or the app stops working.
- No popularity, follower counts or batch lookups, so artists are fetched one by one.

## Local setup

1. Create an app at <https://developer.spotify.com/dashboard>:
   - Redirect URI: `http://127.0.0.1:3000/api/auth/callback`
   - API: **Web API**
   - Under *User Management*, add yourself and your friends (name + Spotify email).
2. Copy `.env.example` to `.env` and fill in `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`
   and `TOKEN_ENCRYPTION_KEY`.
3. Start Postgres and create the tables:
   ```bash
   docker compose -f docker-compose.dev.yml up -d
   npm run db:migrate
   ```
4. Run the web app and the worker, each in its own terminal:
   ```bash
   npm run dev
   npm run worker
   ```
5. Open <http://127.0.0.1:3000>. Use `127.0.0.1`, not `localhost`: Spotify only
   accepts the loopback IP for http redirect URIs, and login cookies are per host.

## Production (Docker)

On the server, next to `docker-compose.yml`:

1. Create `.env` with `APP_URL=https://stats.lucariki.top`, the Spotify credentials,
   `TOKEN_ENCRYPTION_KEY` and a strong `POSTGRES_PASSWORD`.
2. Add `https://stats.lucariki.top/api/auth/callback` as a Redirect URI in the Spotify dashboard.
3. `docker compose up -d --build`. This starts Postgres, applies migrations,
   then starts the web app (port 3000) and the worker.
4. Put a reverse proxy with HTTPS in front of port 3000.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Web app on <http://127.0.0.1:3000> |
| `npm run worker` | Background sync worker |
| `npm run db:generate` | New SQL migration after changing `src/lib/db/schema.ts` |
| `npm run db:migrate` | Apply migrations |
| `npm run typecheck` / `npm run lint` | Checks |

## Layout

- `src/app` — pages, the Spotify login routes (`api/auth`) and server actions
- `src/lib/db/schema.ts` — database tables
- `src/lib/spotify` — Spotify API client and token refresh
- `src/lib/sync.ts`, `src/lib/catalog.ts` — saving plays, tracks, albums and artists
- `src/lib/stats.ts` — stats queries
- `worker/index.ts` — the background worker
