import { ArrowRight, Check, UserRound } from "lucide-react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { LogoMark, Wordmark, Words } from "../components";
import { C, fade, pop, ramp, SITE_URL, useVertical } from "../theme";
import T from "../timeline.json";

// One line per beat, then the big word on the next bar's beat
export const FREE_LINES = ["No subscription.", "No ads.", "Nothing locked."];
export const FREE_LINE_START = 0;
export const FREE_SLAM = 120;

export function Free() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const vertical = useVertical();
  const away = ramp(frame, FREE_SLAM - 8, FREE_SLAM + 8);
  const slam = pop(frame, fps, FREE_SLAM, { damping: 13, stiffness: 190, mass: 0.8 });
  const sub = ramp(frame, FREE_SLAM + 18, FREE_SLAM + 38);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 30,
          opacity: 1 - away,
          transform: `translateY(${-away * 90}px) scale(${1 - away * 0.1})`,
          filter: `blur(${away * 14}px)`,
        }}
      >
        {FREE_LINES.map((line, index) => {
          const p = pop(frame, fps, FREE_LINE_START + index * 30, { damping: 13, stiffness: 180, mass: 0.6 });
          return (
            <div key={line} style={{ display: "flex", alignItems: "center", gap: 34 }}>
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: vertical ? 76 : 88,
                  height: vertical ? 76 : 88,
                  borderRadius: "50%",
                  background: C.accentFill,
                  color: C.accentForeground,
                  transform: `scale(${p}) rotate(${(1 - p) * -90}deg)`,
                }}
              >
                <Check style={{ width: "56%", height: "56%" }} strokeWidth={3} />
              </span>
              <span
                style={{
                  fontSize: vertical ? 84 : 100,
                  fontWeight: 600,
                  letterSpacing: "-0.04em",
                  opacity: fade(p),
                  transform: `translateX(${(1 - p) * -60}px)`,
                  filter: `blur(${Math.max(0, 1 - p) * 12}px)`,
                }}
              >
                {line}
              </span>
            </div>
          );
        })}
      </div>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", textAlign: "center" }}>
        <div
          style={{
            fontSize: vertical ? 260 : 320,
            fontWeight: 700,
            letterSpacing: "-0.06em",
            lineHeight: 1,
            color: C.accent,
            opacity: fade(slam),
            transform: `scale(${interpolate(slam, [0, 1], [2.4, 1])})`,
            filter: `blur(${Math.max(0, 1 - slam) * 20}px)`,
            textShadow: "0 0 120px rgba(34,197,94,0.45)",
          }}
        >
          Free.
        </div>
        <div style={{ fontSize: vertical ? 50 : 60, fontWeight: 500, color: C.muted, marginTop: 20, opacity: sub, transform: `translateY(${(1 - sub) * 24}px)` }}>
          Every feature. Every stat.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

// End card timing, in frames from its start; scripts/soundtrack.mjs plays on these too
const { headline: END_HEADLINE, testers: END_TESTERS, seats: END_SEATS, seatStagger: END_SEAT_STAGGER, cta: END_CTA } = T.endCard;

export function EndCard() {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const vertical = useVertical();
  const mark = pop(frame, fps, 0, { damping: 12, stiffness: 120, mass: 0.8 });
  const bars = [8, 14, 20].map((delay, index) => {
    const rise = pop(frame, fps, delay, { damping: 9, stiffness: 160, mass: 0.6 });
    const idle = frame > 40 ? 0.12 * Math.max(0, Math.sin(frame / 7 + index * 2.1)) : 0;
    return rise * (1 - idle);
  });
  const reveal = ramp(frame, 12, 40);
  const cta = pop(frame, fps, END_CTA, { damping: 13, stiffness: 150, mass: 0.7 });
  const note = ramp(frame, END_CTA + 20, END_CTA + 45);
  const glow = 0.35 + 0.15 * Math.sin(frame / 12);
  const scale = vertical ? 0.72 : 0.78;
  const ending = interpolate(frame, [durationInFrames - 30, durationInFrames], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", textAlign: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 44 * scale, height: 230 * scale }}>
        <div style={{ transform: `scale(${mark})` }}>
          <LogoMark size={230 * scale} bars={bars} />
        </div>
        <div style={{ clipPath: `inset(-20% ${(1 - reveal) * 100}% -20% 0)`, transform: `translateX(${(1 - reveal) * -60}px)` }}>
          <Wordmark size={200 * scale} />
        </div>
      </div>
      <div style={{ fontSize: vertical ? 62 : 68, fontWeight: 600, letterSpacing: "-0.035em", marginTop: 44, padding: "0 80px" }}>
        <Words text="Almost ready for release." delay={END_HEADLINE} stagger={4} />
      </div>
      <div style={{ fontSize: vertical ? 44 : 46, fontWeight: 500, color: C.muted, marginTop: 12, padding: "0 80px" }}>
        <Words text="Looking for 5 testers." delay={END_TESTERS} stagger={4} accent={["5", "testers"]} />
      </div>
      <div style={{ display: "flex", gap: 18, marginTop: 30 }}>
        {Array.from({ length: 5 }, (_, index) => {
          const seat = pop(frame, fps, END_SEATS + index * END_SEAT_STAGGER, { damping: 11, stiffness: 190, mass: 0.6 });
          return (
            <span
              key={index}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 76,
                height: 76,
                borderRadius: "50%",
                border: `2.5px dashed ${C.accent}`,
                background: "rgba(34,197,94,0.08)",
                color: C.accent,
                opacity: fade(seat),
                transform: `scale(${seat})`,
              }}
            >
              <UserRound style={{ width: 36, height: 36 }} strokeWidth={2} />
            </span>
          );
        })}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginTop: 46,
          padding: "24px 44px",
          borderRadius: 999,
          background: C.accentFill,
          color: C.accentForeground,
          fontSize: vertical ? 40 : 42,
          fontWeight: 600,
          letterSpacing: "-0.01em",
          boxShadow: `0 0 90px rgba(34,197,94,${glow})`,
          opacity: fade(cta),
          transform: `scale(${interpolate(cta, [0, 1], [0.6, 1])})`,
        }}
      >
        Join at {SITE_URL}
        <ArrowRight style={{ width: 40, height: 40 }} strokeWidth={2.6} />
      </div>
      <div
        style={{
          position: "absolute",
          bottom: vertical ? 120 : 70,
          left: 0,
          right: 0,
          padding: "0 80px",
          fontSize: 24,
          color: C.subtle,
          opacity: note,
        }}
      >
        Works with your Spotify account. Not affiliated with Spotify.
      </div>
      <AbsoluteFill style={{ background: "#000", opacity: ending }} />
    </AbsoluteFill>
  );
}
