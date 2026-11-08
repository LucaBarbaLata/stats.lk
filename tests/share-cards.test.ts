import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ImageResponse } from "next/og";
import { parseDesign, renderShareCard, SHARE_DESIGNS, SHARE_SIZE, type ShareCard } from "@/lib/share-cards";

// A picture that needs no network, so the Cover design draws its photo
const PICTURE = `data:image/svg+xml;base64,${Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#7c3aed"/></svg>',
).toString("base64")}`;

const item = (id: string, imageUrl: string | null = null) => ({
  id,
  name: `Item ${id}`,
  imageUrl,
  subtitle: "Some artist",
  msPlayed: 600_000,
});

const CARDS: ShareCard[] = [
  { kind: "top-artists", subtitle: "Last 4 weeks", items: [item("a", PICTURE), item("b")] },
  { kind: "top-tracks", subtitle: "All time", items: [item("c")] },
  { kind: "top-tracks", subtitle: "Last year", items: [] },
  { kind: "wrapped", year: 2026, streams: 10, msPlayed: 6_000_000, genre: "pop", artist: item("d", PICTURE), tracks: [item("e")] },
  { kind: "wrapped", year: 2025, streams: 0, msPlayed: 0, genre: null, artist: null, tracks: [] },
];

describe("share cards", () => {
  it("render as PNG in every design", async () => {
    for (const card of CARDS) {
      for (const design of SHARE_DESIGNS) {
        const response = new ImageResponse(renderShareCard(card, design.key, "stats.example"), SHARE_SIZE);
        const bytes = new Uint8Array(await response.arrayBuffer());
        // The PNG signature
        assert.deepEqual([...bytes.slice(0, 4)], [0x89, 0x50, 0x4e, 0x47], `${card.kind} in ${design.key}`);
      }
    }
  });

  it("fall back to the classic design", () => {
    assert.equal(parseDesign("light"), "light");
    assert.equal(parseDesign("neon"), "classic");
    assert.equal(parseDesign(undefined), "classic");
  });
});
