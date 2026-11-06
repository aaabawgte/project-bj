import React, { useEffect, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";

// Inter is the platform's own UI font (css/style.css). The film's display type uses the
// Inter Display cut of the same family, so the ad typography and the product feel like one system.
const faces: [family: string, file: string, weight: number][] = [
  ["Inter", "Inter-Medium.otf", 500],
  ["Inter", "Inter-SemiBold.otf", 600],
  ["Inter", "Inter-Bold.otf", 700],
  ["Inter", "Inter-ExtraBold.otf", 800],
  ["Inter Display", "InterDisplay-SemiBold.otf", 600],
  ["Inter Display", "InterDisplay-Bold.otf", 700],
  ["Inter Display", "InterDisplay-ExtraBold.otf", 800],
];

const css = faces
  .map(([family, file, weight]) => `@font-face{font-family:"${family} Film";src:url("${staticFile(`fonts/${file}`)}") format("opentype");font-weight:${weight};font-style:normal;font-display:block;}`)
  .join("\n");

export const FONT_UI = `"Inter Film", "Inter", sans-serif`;
export const FONT_DISPLAY = `"Inter Display Film", "Inter Film", "Inter", sans-serif`;

export const Fonts: React.FC = () => {
  const [handle] = useState(() => delayRender("Loading fonts"));
  useEffect(() => {
    Promise.all(faces.map(([family, , weight]) => document.fonts.load(`${weight} 40px "${family} Film"`)))
      .then(() => continueRender(handle))
      .catch(() => continueRender(handle));
  }, [handle]);
  return <style>{css}</style>;
};
