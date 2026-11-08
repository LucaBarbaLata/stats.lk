# stats.lk trailer

A 37-second promo video made with [Remotion](https://remotion.dev) (React rendered to MP4).
It has its own packages and is left out of the app's typecheck, lint and Docker build.

```bash
cd promo
npm.cmd install
npm.cmd run studio            # preview and scrub in the browser
npm.cmd run render            # out/stats-lk-trailer.mp4 (1920x1080, 60 fps)
npm.cmd run render:vertical   # out/stats-lk-trailer-vertical.mp4 (1080x1920, for Reels/TikTok/Stories)
```

## With your own stats

The default render uses made-up numbers. To use a real listener's, export them from the
app's database first (from the repo root, with the database running):

```bash
npm.cmd run promo:stats            # the user with the most plays
npm.cmd run promo:stats -- lucariki
```

That writes `promo/public/me/` (numbers and pictures, gitignored). Then, in `promo/`:

```bash
npm.cmd run studio:me
npm.cmd run render:me             # out/stats-lk-trailer-me.mp4
npm.cmd run render:me:vertical    # out/stats-lk-trailer-me-vertical.mp4
```

The numbers are the ones the site shows for this year (top lists by plays, Wrapped by minutes),
leaving out hidden artists and tracks. The friends in the video stay made up, and when a
listener has fewer than two trophies of a tier, locked ones stand in at that tier (the script
lists them).

## Changing it

- `src/timeline.json`: when each scene starts (frames at 60 fps, a beat is 30 frames at 120 BPM).
- `src/scenes/`: the scenes and their texts. The site address is `SITE_URL` in `src/theme.ts`.
- `src/data.ts`: the shape of the data, and the made-up sample.
- `scripts/soundtrack.mjs`: synthesises the music from the timeline, so it follows any timing change.
  To use your own track, put it in `public/` and change `MUSIC` in `src/Trailer.tsx`.
- A render fails with `EPERM ... rename` when the old video is open in a player: close it first.
