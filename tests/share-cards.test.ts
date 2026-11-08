import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ImageResponse } from "next/og";
import {
  DEFAULT_STATS,
  DEFAULT_TITLE,
  MAX_STATS,
  MAX_TITLE,
  parseShareConfig,
  planStats,
  RANKING_LAYOUTS,
  shareQuery,
  STATS,
  SUMMARY_LAYOUTS,
  WRAPPED_STATS,
  type ShareData,
  type StatKey,
  type StatValue,
} from "@/lib/share/options";
import { renderShareCard, SHARE_SIZE } from "@/lib/share/render";
import { THEME_KEYS, type ThemeKey } from "@/lib/share/themes";

// A picture that needs no network
const PICTURE = `data:image/svg+xml;base64,${Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#7c3aed"/></svg>',
).toString("base64")}`;

const items = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    id: String(index),
    name: `Item number ${index + 1} with a fairly long name`,
    imageUrl: index % 3 === 2 ? null : PICTURE,
    subtitle: "Some artist",
  }));

const RANKING: ShareData = { kind: "ranking", title: "My top artists", subtitle: "Last 4 weeks", items: items(10), round: true };

function summary(stats: StatKey[]): Extract<ShareData, { kind: "summary" }> {
  const values: Partial<Record<StatKey, StatValue>> = {};
  for (const stat of STATS) {
    values[stat.key] =
      stat.kind === "number"
        ? { kind: "number", value: "123,456", label: "a label for it" }
        : stat.kind === "feature"
          ? { kind: "feature", label: stat.label, item: items(1)[0] }
          : { kind: "list", label: stat.label, items: items(5) };
  }
  return { kind: "summary", title: "A title as long as allowed!!", subtitle: "All time", stats, values, picture: PICTURE };
}

async function render(data: ShareData, layout: string, theme: ThemeKey) {
  const response = new ImageResponse(renderShareCard(data, { layout: layout as never, theme }, "stats.example"), SHARE_SIZE);
  const bytes = new Uint8Array(await response.arrayBuffer());
  // The PNG signature
  assert.deepEqual([...bytes.slice(0, 4)], [0x89, 0x50, 0x4e, 0x47], `${data.kind} as ${layout} in ${theme}`);
}

describe("share card pictures", () => {
  it("render every top list layout", async () => {
    for (const layout of RANKING_LAYOUTS) await render(RANKING, layout.key, "classic");
    await render({ ...RANKING, items: [] }, "podium", "classic");
    await render({ ...RANKING, items: items(2) }, "podium", "classic");
  });

  it("render every stat card layout", async () => {
    for (const layout of SUMMARY_LAYOUTS) {
      await render(summary(WRAPPED_STATS), layout.key, "classic");
      await render(summary(["minutes", "plays", "streak", "level", "top-track", "artists-list"]), layout.key, "classic");
      await render({ ...summary([]), picture: null }, layout.key, "classic");
    }
  });

  it("render in every theme", async () => {
    for (const theme of THEME_KEYS) {
      await render(RANKING, "poster", theme);
      await render(summary(WRAPPED_STATS), "poster", theme);
    }
  });
});

describe("share card settings", () => {
  it("fall back to defaults", () => {
    const config = parseShareConfig({}, 2026);
    assert.equal(config.card, "top-artists");
    assert.equal(config.layout, "list");
    assert.equal(config.theme, "classic");
    assert.equal(config.range, "4w");
    assert.equal(config.year, 2026);
    assert.equal(config.title, DEFAULT_TITLE);
    assert.deepEqual(config.stats, DEFAULT_STATS);
    assert.equal(parseShareConfig({ theme: "neon", period: "lately" }, 2026).theme, "classic");
    assert.equal(parseShareConfig({ period: "lately" }, 2026).period, "4w");
    assert.equal(parseShareConfig({ period: "2024" }, 2026).period, "2024");
  });

  it("only take layouts the card has", () => {
    assert.equal(parseShareConfig({ card: "wrapped", layout: "grid" }, 2026).layout, "stack");
    assert.equal(parseShareConfig({ card: "custom", layout: "tiles" }, 2026).layout, "tiles");
    assert.equal(parseShareConfig({ card: "top-albums", layout: "tiles" }, 2026).layout, "list");
  });

  it("read stats from links and forms, in card order and capped", () => {
    const parse = (stats: string | string[]) => parseShareConfig({ stats }, 2026).stats;
    assert.deepEqual(parse("tracks-list,minutes,nope"), ["minutes", "tracks-list"]);
    assert.deepEqual(parse(["", "plays", "minutes"]), ["minutes", "plays"]);
    assert.deepEqual(parse(""), []);
    assert.equal(parse(STATS.map((stat) => stat.key).join(",")).length, MAX_STATS);
  });

  it("tidy the title", () => {
    assert.equal(parseShareConfig({ title: "  My   summer \n" }, 2026).title, "My summer");
    assert.equal(parseShareConfig({ title: "   " }, 2026).title, DEFAULT_TITLE);
    assert.equal(parseShareConfig({ title: "x".repeat(100) }, 2026).title.length, MAX_TITLE);
  });

  it("survive the trip through the image URL", () => {
    const config = parseShareConfig(
      { card: "custom", layout: "poster", theme: "sunset", period: "2025", title: "Summer", stats: "plays,top-album" },
      2026,
    );
    const back = parseShareConfig({ ...Object.fromEntries(new URLSearchParams(shareQuery(config))), card: "custom" }, 2026);
    assert.deepEqual(back, config);
  });
});

describe("fitting stats on a card", () => {
  it("fits Wrapped in every layout", () => {
    for (const layout of SUMMARY_LAYOUTS) assert.deepEqual(planStats(layout.key, WRAPPED_STATS).dropped, [], layout.key);
  });

  it("puts numbers two to a row", () => {
    const { rows } = planStats("stack", ["minutes", "plays", "artists", "top-artist"]);
    assert.deepEqual(
      rows.map((row) => row.stats),
      [["minutes", "plays"], ["artists"], ["top-artist"]],
    );
  });

  it("leaves out what doesn't fit, keeping what comes first", () => {
    const { rows, dropped } = planStats("poster", ["minutes", "plays", "top-track", "top-album", "artists-list", "tracks-list"]);
    assert.ok(dropped.includes("tracks-list"));
    assert.ok(rows.some((row) => row.stats.includes("minutes")));
  });
});
