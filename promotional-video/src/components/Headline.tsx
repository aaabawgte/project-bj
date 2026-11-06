import React from "react";
import { clamp01, easeIn, easeOut } from "../lib/anim";
import { FONT_DISPLAY } from "./Fonts";

export type HeadlineSpec = { from: number; to: number; primary: string; secondary?: string };

type Props = {
  frame: number;
  spec: HeadlineSpec;
  vertical: boolean;
  dark?: number; // 0..1 blend toward dark backdrop colors
  top: number;
  size: number;
  width: number;
};

const mix = (a: number[], b: number[], t: number) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(",")})`;

/**
 * Two-tone Apple-style headline: primary statement in near-black, secondary in grey.
 * Each phrase rises 0.8 s with a soft blur-to-sharp focus pull, staggered.
 */
export const Headline: React.FC<Props> = ({ frame, spec, vertical, dark = 0, top, size, width }) => {
  const { from, to } = spec;
  if (frame < from - 1 || frame > to + 1) return null;
  const parts = [spec.primary, spec.secondary].filter(Boolean) as string[];
  const out = clamp01((frame - (to - 12)) / 12);
  const primaryColor = mix([29, 29, 31], [245, 245, 247], dark);
  const secondaryColor = mix([134, 134, 139], [134, 134, 139], dark);

  return (
    <div
      style={{
        position: "absolute",
        left: (1 - 1) * 0 + 0,
        top,
        width,
        display: "flex",
        flexDirection: vertical ? "column" : "row",
        justifyContent: "center",
        alignItems: "center",
        gap: vertical ? 0 : size * 0.26,
        fontFamily: FONT_DISPLAY,
        fontWeight: 700,
        fontSize: size,
        lineHeight: 1.08,
        letterSpacing: "-0.028em",
        textAlign: "center",
        whiteSpace: "nowrap",
      }}
    >
      {parts.map((text, i) => {
        const t = easeOut(clamp01((frame - from - i * 7) / 26));
        const o = t * (1 - easeIn(out));
        const y = (1 - t) * size * 0.42 - easeIn(out) * size * 0.12;
        const blur = (1 - t) * 14 + easeIn(out) * 8;
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              color: i === 0 ? primaryColor : secondaryColor,
              opacity: o,
              transform: `translateY(${y}px)`,
              filter: blur > 0.05 ? `blur(${blur}px)` : undefined,
            }}
          >
            {text}
          </span>
        );
      })}
    </div>
  );
};
