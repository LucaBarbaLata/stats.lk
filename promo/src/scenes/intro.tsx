import { Flame, MicVocal, Play } from "lucide-react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { LogoMark, Odometer, Wordmark, Words } from "../components";
import { useData } from "../data";
import { C, fade, fmt, pop, ramp, useVertical } from "../theme";

// Word by word, one every eighth note (scripts/soundtrack.mjs plays a note on each)
export const HOOK_WORDS = ["You", "hit", "play", "thousands", "of", "times", "a", "year."];
export const HOOK_START = 15;
export const HOOK_STAGGER = 15;

export function Hook() {
  const frame = useCurrentFrame();
  const vertical = useVertical();
  const push = interpolate(frame, [0, 200], [1, 1.07]);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: vertical ? "0 80px" : "0 200px" }}>
      <div
        style={{
          fontSize: vertical ? 110 : 132,
          fontWeight: 600,
          lineHeight: 1.04,
          letterSpacing: "-0.045em",
          textAlign: "center",
          transform: `scale(${push})`,
        }}
      >
        <Words text={HOOK_WORDS.slice(0, 3).join(" ")} delay={HOOK_START} stagger={HOOK_STAGGER} slam />
        <br />
        <Words text={HOOK_WORDS.slice(3).join(" ")} delay={HOOK_START + 3 * HOOK_STAGGER} stagger={HOOK_STAGGER} accent={["thousands"]} slam />
      </div>
    </AbsoluteFill>
  );
}

export function Counter() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const vertical = useVertical();
  const data = useData();
  const chips = [
    { icon: Play, text: `${fmt(data.plays)} plays` },
    { icon: MicVocal, text: `${fmt(data.artists)} artists` },
    { icon: Flame, text: `${data.streak}-day streak` },
  ];
  const counting = ramp(frame, 10, 100);
  const unit = pop(frame, fps, 26);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", textAlign: "center" }}>
      <div
        style={{
          position: "absolute",
          width: 1100,
          height: 700,
          borderRadius: "50%",
          background: `radial-gradient(ellipse, rgba(34,197,94,${0.05 + counting * 0.2}) 0%, rgba(0,0,0,0) 65%)`,
        }}
      />
      <div style={{ fontSize: vertical ? 42 : 46, color: C.muted, fontWeight: 500 }}>
        <Words text="This year, you listened to" delay={2} stagger={3} />
      </div>
      {/* Relative, so the comma isn't painted under the glow above */}
      <div style={{ position: "relative", margin: "10px 0 0", lineHeight: 1 }}>
        <Odometer target={data.minutes} start={10} end={100} fontSize={vertical ? 200 : 290} />
      </div>
      <div
        style={{
          fontSize: vertical ? 60 : 68,
          fontWeight: 600,
          letterSpacing: "-0.03em",
          color: C.accent,
          opacity: fade(unit),
          transform: `translateY(${(1 - unit) * 30}px)`,
        }}
      >
        minutes of music
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 18, marginTop: 56, padding: "0 60px" }}>
        {chips.map(({ icon: Icon, text }, index) => {
          const p = pop(frame, fps, 98 + index * 8);
          return (
            <span
              key={text}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "16px 28px",
                borderRadius: 999,
                background: C.surface,
                border: `1.5px solid ${C.border}`,
                fontSize: 32,
                fontWeight: 500,
                opacity: fade(p),
                transform: `translateY(${(1 - p) * 40}px) scale(${interpolate(p, [0, 1], [0.8, 1])})`,
              }}
            >
              <Icon style={{ width: 30, height: 30, color: C.accent }} />
              {text}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

export function LogoReveal() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const vertical = useVertical();
  const mark = pop(frame, fps, 0, { damping: 11, stiffness: 120, mass: 0.8 });
  const bars = [6, 12, 18].map((delay, index) => {
    const rise = pop(frame, fps, delay, { damping: 9, stiffness: 160, mass: 0.6 });
    // After landing, the meter bounces on the beat
    const beat = frame > 40 ? Math.exp(-((frame + index * 10) % 30) / 8) * 0.18 : 0;
    return rise * (1 - beat);
  });
  const reveal = ramp(frame, 10, 38);
  const flash = interpolate(frame, [0, 26], [0.85, 0], { extrapolateRight: "clamp" });
  const wave = ramp(frame, 0, 48);
  const scale = vertical ? 0.72 : 1;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <AbsoluteFill style={{ background: `radial-gradient(circle, rgba(74,222,128,${flash}) 0%, rgba(34,197,94,${flash * 0.4}) 30%, rgba(0,0,0,0) 70%)` }} />
      <div
        style={{
          position: "absolute",
          width: 400,
          height: 400,
          borderRadius: "50%",
          border: `4px solid ${C.accent}`,
          opacity: (1 - wave) * 0.8,
          transform: `scale(${0.3 + wave * 4})`,
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 44 * scale, transform: `scale(${scale})` }}>
        <div style={{ transform: `scale(${mark}) rotate(${(1 - mark) * -120}deg)` }}>
          <LogoMark size={230} bars={bars} />
        </div>
        <div style={{ clipPath: `inset(-20% ${(1 - reveal) * 100}% -20% 0)`, transform: `translateX(${(1 - reveal) * -60}px)` }}>
          <Wordmark size={200} />
        </div>
      </div>
      <div style={{ marginTop: 54, fontSize: vertical ? 46 : 52, fontWeight: 500, color: C.muted, textAlign: "center", padding: "0 80px" }}>
        <Words text="Your Spotify stats. All of them. Free." delay={40} stagger={4} accent={["Free"]} />
      </div>
    </AbsoluteFill>
  );
}
