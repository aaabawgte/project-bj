import React from "react";
import { clamp01, easeOut } from "../lib/anim";

/** Standard arrow pointer, drawn in viewport CSS px (rendered inside the device overlay). */
export const Cursor: React.FC<{ x: number; y: number; opacity: number; press: number; ring: number }> = ({ x, y, opacity, press, ring }) => {
  if (opacity <= 0) return null;
  const scale = 1 - 0.14 * press;
  return (
    <>
      {ring > 0 && ring < 1 ? (
        <div
          style={{
            position: "absolute",
            left: x - 4 - 20 * easeOut(ring),
            top: y - 4 - 20 * easeOut(ring),
            width: 8 + 40 * easeOut(ring),
            height: 8 + 40 * easeOut(ring),
            borderRadius: "50%",
            background: "rgba(0,122,255,.16)",
            border: "1.5px solid rgba(0,122,255,.35)",
            opacity: (1 - ring) * opacity,
          }}
        />
      ) : null}
      <svg
        width={22}
        height={28}
        viewBox="-1.5 -1.5 22 28"
        style={{
          position: "absolute",
          left: x - 1.5,
          top: y - 1.5,
          opacity,
          transform: `scale(${scale})`,
          transformOrigin: "1.5px 1.5px",
          filter: "drop-shadow(0 1.5px 2.5px rgba(0,0,0,.32))",
          overflow: "visible",
        }}
      >
        <path d="M0 0 L0 19.6 L4.6 15.3 L7.7 22.4 L10.9 21.0 L7.8 14.1 L14.1 14.1 Z" fill="#000" stroke="#fff" strokeWidth={1.6} strokeLinejoin="round" />
      </svg>
    </>
  );
};

/** Touch indicator for the phone (viewport CSS px). `t` 0→1 over the tap. */
export const Touch: React.FC<{ x: number; y: number; t: number; hold?: boolean }> = ({ x, y, t, hold }) => {
  if (!hold && (t <= 0 || t >= 1)) return null;
  const appear = hold ? 1 : clamp01(t / 0.25);
  const fade = hold ? 1 : 1 - clamp01((t - 0.45) / 0.55);
  const r = 23 * (0.7 + 0.3 * easeOut(appear));
  return (
    <div
      style={{
        position: "absolute",
        left: x - r,
        top: y - r,
        width: r * 2,
        height: r * 2,
        borderRadius: "50%",
        background: "rgba(255,255,255,.55)",
        border: "1.5px solid rgba(0,0,0,.14)",
        boxShadow: "0 4px 14px rgba(0,0,0,.18)",
        opacity: appear * fade * 0.95,
        backdropFilter: "blur(2px)",
      }}
    />
  );
};
