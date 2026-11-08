import type { ComponentType, ReactNode } from "react";
import { AbsoluteFill, Easing, Html5Audio, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Background } from "./components";
import { DataProvider, type TrailerProps } from "./data";
import { Activity, Friends, HistoryImport, TopLists, Trophies, Wrapped } from "./scenes/features";
import { Counter, Hook, LogoReveal } from "./scenes/intro";
import { EndCard, Free } from "./scenes/outro";
import { C, fontFamily } from "./theme";
import T from "./timeline.json";

const MUSIC = "soundtrack.wav";

type SceneId = keyof typeof T.cuts;

const SCENES: { id: SceneId; component: ComponentType }[] = [
  { id: "hook", component: Hook },
  { id: "counter", component: Counter },
  { id: "logo", component: LogoReveal },
  { id: "top", component: TopLists },
  { id: "activity", component: Activity },
  { id: "history", component: HistoryImport },
  { id: "friends", component: Friends },
  { id: "trophies", component: Trophies },
  { id: "wrapped", component: Wrapped },
  { id: "free", component: Free },
  { id: "end", component: EndCard },
];

// The outgoing scene punches toward the viewer and blurs away while the next one comes in
function Exit({ duration, children }: { duration: number; children: ReactNode }) {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [duration - T.overlap, duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.cubic),
  });
  if (p === 0) return <AbsoluteFill>{children}</AbsoluteFill>;
  return (
    <AbsoluteFill style={{ opacity: 1 - p, transform: `scale(${1 + p * 0.12})`, filter: `blur(${p * 18}px)` }}>{children}</AbsoluteFill>
  );
}

export function Trailer({ data }: TrailerProps) {
  const frame = useCurrentFrame();
  const fromBlack = interpolate(frame, [0, 16], [1, 0], { extrapolateRight: "clamp" });
  return (
    <DataProvider value={data}>
      <AbsoluteFill style={{ fontFamily, color: C.foreground, fontFeatureSettings: '"ss01", "cv11"' }}>
        <Background />
        {SCENES.map(({ id, component: Scene }, index) => {
          const from = T.cuts[id];
          const next = SCENES[index + 1];
          const duration = next ? T.cuts[next.id] - from + T.overlap : T.duration - from;
          return (
            <Sequence key={id} name={id} from={from} durationInFrames={duration}>
              {next ? (
                <Exit duration={duration}>
                  <Scene />
                </Exit>
              ) : (
                <Scene />
              )}
            </Sequence>
          );
        })}
        <AbsoluteFill style={{ background: "#000", opacity: fromBlack, pointerEvents: "none" }} />
        {/* Made by scripts/soundtrack.mjs. For your own music, put the file in public/ and change the name here. */}
        <Html5Audio src={staticFile(MUSIC)} />
      </AbsoluteFill>
    </DataProvider>
  );
}
