import React from "react";
import { Composition } from "remotion";
import { Film } from "./Film";
import T from "./timeline.json";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="ProjectBJVertical"
      component={Film}
      durationInFrames={T.duration}
      fps={T.fps}
      width={1080}
      height={1920}
      defaultProps={{ format: "vertical" as const, withAudio: true }}
    />
    <Composition
      id="ProjectBJLandscape"
      component={Film}
      durationInFrames={T.duration}
      fps={T.fps}
      width={1920}
      height={1080}
      defaultProps={{ format: "landscape" as const, withAudio: true }}
    />
  </>
);
