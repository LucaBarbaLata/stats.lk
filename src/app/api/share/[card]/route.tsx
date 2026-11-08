import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { appUrl } from "@/lib/env";
import { getCurrentUser } from "@/lib/session";
import { loadShareData } from "@/lib/share/data";
import { CARDS, parseShareConfig } from "@/lib/share/options";
import { renderShareCard, SHARE_SIZE } from "@/lib/share/render";

// A share image (PNG) for the logged-in user, as set up on /share. It only
// shows what the user doesn't hide from others.
export async function GET(request: NextRequest, ctx: RouteContext<"/api/share/[card]">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Not logged in", { status: 401 });
  const { card } = await ctx.params;
  if (!CARDS.some((option) => option.key === card)) return new Response("Unknown card", { status: 404 });

  const search = request.nextUrl.searchParams;
  const config = parseShareConfig(
    { ...Object.fromEntries(search), card, stats: search.has("stats") ? search.getAll("stats") : undefined },
    new Date().getFullYear(),
  );
  const data = await loadShareData(user.id, config);
  const element = renderShareCard(data, config, new URL(appUrl()).host);

  return new ImageResponse(element, {
    ...SHARE_SIZE,
    headers: {
      "Cache-Control": "private, no-store",
      ...(search.get("download") === "1" && { "Content-Disposition": `attachment; filename="stats-lk-${card}.png"` }),
    },
  });
}
