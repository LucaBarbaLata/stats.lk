// Exports one listener's real numbers for the promo trailer (promo/), with the
// pictures it needs, to promo/public/me/. That folder is gitignored: it's
// personal. Hidden artists and tracks are left out, as on a public profile.
//
//   npm run promo:stats              (the only user, or the one with most plays)
//   npm run promo:stats -- lucariki  (someone in particular)
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { desc, eq, sql } from "drizzle-orm";
import { client, db } from "../src/lib/db";
import { streams, users } from "../src/lib/db/schema";
import { addDays, computeStreaks, isoWeekday, today } from "../src/lib/dates";
import { levelFor } from "../src/lib/levels";
import { yearRange } from "../src/lib/periods";
import { ALL_TIME, type Range } from "../src/lib/ranges";
import {
  getActivity,
  getDailyTotals,
  getListeningTotals,
  getPeriodTotals,
  getTopAlbums,
  getTopArtists,
  getTopGenres,
  getTopTracks,
  type TopItem,
} from "../src/lib/stats";
import { evaluateTrophies } from "../src/lib/trophies";
import { getTrophyMetrics } from "../src/lib/trophy-metrics";

const OUT = join(process.cwd(), "promo", "public", "me");
// Colour tiles for anything without a picture, as on the landing page
const HUES = [152, 24, 262, 198, 330];

async function pickUser(username: string | undefined) {
  if (username) {
    const [user] = await db.select().from(users).where(eq(users.username, username.toLowerCase()));
    if (!user) throw new Error(`No user called ${username}`);
    return user;
  }
  const [top] = await db
    .select({ id: users.id })
    .from(users)
    .innerJoin(streams, eq(streams.userId, users.id))
    .groupBy(users.id)
    .orderBy(desc(sql`count(*)`))
    .limit(1);
  if (!top) throw new Error("Nobody has any plays yet");
  const [user] = await db.select().from(users).where(eq(users.id, top.id));
  return user;
}

let saved = 0;
// Saves a picture next to stats.json and returns its path inside promo/public
async function picture(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const type = response.headers.get("content-type") ?? "";
    const name = `${++saved}.${type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg"}`;
    await writeFile(join(OUT, name), Buffer.from(await response.arrayBuffer()));
    return `me/${name}`;
  } catch {
    return null;
  }
}

async function main() {
  const user = await pickUser(process.argv[2]);
  const day = today();
  const year = Number(day.slice(0, 4));
  const thisYear = yearRange(year);
  const options = { publicOnly: true };

  const [totals, yearTotals, artists, artistsByMinutes, albums, tracks, genres, hours, daily, months, metrics] = await Promise.all([
    getListeningTotals(user.id),
    getPeriodTotals(user.id, thisYear),
    getTopArtists(user.id, thisYear, "plays", 5, options),
    getTopArtists(user.id, thisYear, "minutes", 1, options),
    getTopAlbums(user.id, thisYear, "plays", 5, options),
    getTopTracks(user.id, thisYear, "plays", 5, options),
    getTopGenres(user.id, thisYear, "plays", 5, options),
    getActivity(user.id, "hour", thisYear),
    getDailyTotals(user.id, thisYear),
    getActivity(user.id, "month", ALL_TIME),
    getTrophyMetrics(user.id),
  ]);
  if (!yearTotals.streams) throw new Error(`${user.username} has no plays in ${year}`);

  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  const artist = async (item: TopItem, index: number) => ({
    name: item.name,
    plays: item.streams,
    minutes: Math.round(item.msPlayed / 60_000),
    image: await picture(item.imageUrl),
    hue: HUES[index % HUES.length],
  });
  const topArtists = await Promise.all(artists.map(artist));
  const topTracks = await Promise.all(
    tracks.map(async (item, index) => ({
      name: item.name,
      artist: item.subtitle,
      plays: item.streams,
      image: await picture(item.imageUrl),
      hue: HUES[index % HUES.length],
    })),
  );
  const topAlbums = await Promise.all(
    albums.map(async (item, index) => ({
      name: item.name,
      artist: item.subtitle,
      plays: item.streams,
      minutes: Math.round(item.msPlayed / 60_000),
      image: await picture(item.imageUrl),
      hue: HUES[index % HUES.length],
    })),
  );
  const topGenres = genres.map((item, index) => ({
    name: item.name,
    plays: item.streams,
    minutes: Math.round(item.msPlayed / 60_000),
    hue: HUES[index % HUES.length],
  }));
  const sameAsTop = topArtists.find((top) => top.name === artistsByMinutes[0]?.name);
  const wrappedArtist = sameAsTop ?? (artistsByMinutes[0] ? await artist(artistsByMinutes[0], 0) : topArtists[0]);

  // 24 weeks of days, ending with the week of the last play
  const minutesByDay = new Map<string, number>();
  const lastDay = daily.at(-1)!.key;
  const weekEnd = addDays(lastDay, 7 - isoWeekday(lastDay));
  const weekStart = addDays(weekEnd, -24 * 7 + 1);
  const heatRange: Range = { key: "custom", from: weekStart, to: weekEnd, label: "" };
  for (const row of await getDailyTotals(user.id, heatRange)) minutesByDay.set(row.key, row.msPlayed / 60_000);
  const heat = Array.from({ length: 24 * 7 }, (_, index) => {
    const date = addDays(weekStart, index);
    return date > lastDay ? -1 : Math.round(minutesByDay.get(date) ?? 0);
  });

  const hourMinutes = Array.from({ length: 24 }, (_, hour) => {
    const row = hours.find((bucket) => Number(bucket.key) === hour);
    return row ? Math.round(row.msPlayed / 60_000) : 0;
  });

  const yearsPlays = new Map<number, number>();
  for (const month of months) {
    const monthYear = Number(month.key.slice(0, 4));
    yearsPlays.set(monthYear, (yearsPlays.get(monthYear) ?? 0) + month.streams);
  }
  const firstYear = Math.min(...yearsPlays.keys());
  const playsByYear = Array.from({ length: year - firstYear + 1 }, (_, index) => yearsPlays.get(firstYear + index) ?? 0);

  const level = levelFor(totals.msTotal / 60_000);
  // Two of each tier, as gold, silver, bronze, gold, silver, bronze. A tier with
  // too few real trophies takes locked ones, closest to unlocking first: those
  // are shown at a tier not reached yet, and listed below.
  const evaluated = evaluateTrophies(metrics).filter((trophy) => trophy.tiers.length > 1);
  const locked = evaluated.filter((trophy) => trophy.tier === 0).sort((a, b) => b.progress - a.progress);
  const borrowed: string[] = [];
  const byTier = [3, 2, 1].map((tier) => {
    const real = evaluated.filter((trophy) => trophy.tier === tier).slice(0, 2);
    while (real.length < 2 && locked.length) {
      const stand = locked.shift()!;
      borrowed.push(`${stand.name} (shown as ${["", "bronze", "silver", "gold"][tier]})`);
      real.push({ ...stand, tier });
    }
    return real;
  });
  const trophies = [0, 1]
    .flatMap((round) => byTier.map((tier) => tier[round]))
    .filter(Boolean)
    .map((trophy) => ({ name: trophy.name, icon: trophy.icon, tier: trophy.tier }));

  const data = {
    year,
    minutes: Math.round(yearTotals.msPlayed / 60_000),
    plays: yearTotals.streams,
    artists: yearTotals.artists,
    streak: computeStreaks(daily.map((row) => row.key), day).longest?.length ?? 0,
    topArtists,
    topAlbums,
    topGenres,
    topTracks,
    wrappedArtist,
    topGenre: genres[0]?.name ?? null,
    heat,
    hours: hourMinutes,
    imported: totals.importedStreams,
    firstYear,
    playsByYear,
    level: {
      level: level.level,
      title: level.title,
      progress: level.progress,
      toNext: level.nextLevelAt === null ? null : Math.ceil(level.nextLevelAt - level.minutes),
    },
    trophies,
    // Made-up friends, playing tracks from your own list
    friends: [
      { name: "Maya", hue: 300, track: topTracks[3] ?? topTracks[0] },
      { name: "Andrei", hue: 40, track: topTracks[4] ?? topTracks[1] ?? topTracks[0] },
    ],
    tasteMatch: 81,
  };

  await writeFile(join(OUT, "stats.json"), `${JSON.stringify({ data }, null, 2)}\n`);
  console.log(`${user.username}, ${year}: ${data.minutes.toLocaleString("en-US")} min, ${data.plays.toLocaleString("en-US")} plays, ${data.artists} artists, ${data.streak}-day streak`);
  console.log(`Top artist ${topArtists[0]?.name}, album ${topAlbums[0]?.name}, genre ${topGenres[0]?.name}, track ${topTracks[0]?.name}`);
  console.log(`Level ${level.level} (${level.title}), trophies: ${trophies.map((trophy) => `${trophy.name} ${trophy.tier}`).join(", ")}`);
  if (borrowed.length) console.log(`Not unlocked yet: ${borrowed.join(", ")}`);
  console.log(`${saved} pictures`);
  console.log(`Written to promo/public/me/. Render with: cd promo, npm.cmd run render:me`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => client.end());
