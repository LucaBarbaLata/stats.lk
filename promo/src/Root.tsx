import { Composition } from "remotion";
import { SAMPLE, type TrailerProps } from "./data";
import T from "./timeline.json";
import { Trailer } from "./Trailer";

// Made-up numbers by default; `--props=public/me/stats.json` swaps in real ones
const defaultProps: TrailerProps = { data: SAMPLE };

export function Root() {
  return (
    <>
      {/* YouTube, the landing page, a README */}
      <Composition
        id="Trailer"
        component={Trailer}
        defaultProps={defaultProps}
        durationInFrames={T.duration}
        fps={T.fps}
        width={1920}
        height={1080}
      />
      {/* TikTok, Reels, Stories */}
      <Composition
        id="TrailerVertical"
        component={Trailer}
        defaultProps={defaultProps}
        durationInFrames={T.duration}
        fps={T.fps}
        width={1080}
        height={1920}
      />
    </>
  );
}
