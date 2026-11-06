import React from "react";
import { Img, staticFile } from "remotion";
import { FONT_UI } from "./Fonts";

export type DeviceKind = "browser" | "phone";
export type Theme = "light" | "dark";

/** One authentic capture shown inside the device screen. */
export type ScreenLayer = { src: string; scrollY: number; opacity: number };

// Platform theme colors, taken verbatim from css/style.css (:root and [data-theme="dark"]).
export const APP = {
  light: { bg: "#f5f5f7", card: "#fff", input: "#f0f0f3", border: "#e5e5ea", text: "#1c1c1e", muted: "#8e8e93" },
  dark: { bg: "#111113", card: "#1c1c1e", input: "#2c2c2e", border: "#3a3a3c", text: "#f5f5f7", muted: "#98989d" },
};

export const PHONE_STATUS_CSS = 54; // status bar height in CSS px above the captured viewport

export type DeviceGeometry = {
  kind: DeviceKind;
  x: number; // screen-content origin (top-left of the captured viewport) in composition px
  y: number;
  s: number; // composition px per CSS px
  vw: number; // viewport CSS size
  vh: number;
  width: number; // device content width in composition px
};

/** Geometry for a device whose OUTER top-left is at (left, top) and content width is `width`. */
export function geometry(kind: DeviceKind, left: number, top: number, width: number, vw: number, vh: number): DeviceGeometry {
  const s = width / vw;
  const chrome = kind === "browser" ? browserChromeH(width) : PHONE_STATUS_CSS * s;
  const bezel = kind === "phone" ? phoneBezel(width) : 0;
  return { kind, x: left + bezel, y: top + bezel + chrome, s, vw, vh, width };
}

export const browserChromeH = (width: number) => Math.round(width * 0.03);
export const phoneBezel = (width: number) => Math.round(width * 0.034);

/** Map viewport CSS coordinates to composition coordinates (before camera). */
export function toComp(g: DeviceGeometry, cssX: number, cssY: number) {
  return { x: g.x + cssX * g.s, y: g.y + cssY * g.s };
}

type Props = {
  g: DeviceGeometry;
  layers: ScreenLayer[];
  theme: Theme;
  url?: string;
  /** Rendered above the screen in viewport CSS coordinates (cursor, touches). */
  overlay?: React.ReactNode;
  shadow?: boolean;
  /** Clip the screen to this many CSS px of height (defaults to full viewport). */
  screenH?: number;
  /** Zoom/pan applied inside the screen (composition px, origin top-left of the screen). */
  innerTransform?: string;
};

export const Device: React.FC<Props> = ({ g, layers, theme, url, overlay, shadow = true, screenH, innerTransform }) => {
  const c = APP[theme];
  const sh = (screenH ?? g.vh) * g.s;
  const overlayLayer = overlay ? (
    <div style={{ position: "absolute", left: 0, top: 0, width: g.vw, height: g.vh, transform: `scale(${g.s})`, transformOrigin: "0 0", pointerEvents: "none" }}>
      {overlay}
    </div>
  ) : null;

  const screen = (
    <div style={{ position: "absolute", left: 0, top: 0, width: g.width, height: sh, overflow: "hidden", background: c.bg }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: g.width, height: sh, transform: innerTransform, transformOrigin: "0 0" }}>
      {layers.map((l, i) =>
        l.opacity <= 0.001 ? null : (
          <Img
            key={`${l.src}-${i}`}
            src={staticFile(l.src)}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: g.width,
              transform: `translate3d(0, ${-l.scrollY * g.s}px, 0)`,
              opacity: l.opacity,
              imageRendering: "auto",
            }}
          />
        ),
      )}
      {overlayLayer}
      </div>
    </div>
  );


  if (g.kind === "browser") {
    const ch = browserChromeH(g.width);
    const radius = Math.round(g.width * 0.011);
    const dark = theme === "dark";
    return (
      <div
        style={{
          position: "absolute",
          left: g.x,
          top: g.y - ch,
          width: g.width,
          height: ch + sh,
          borderRadius: radius,
          overflow: "hidden",
          background: dark ? "#2a2a2c" : "#ffffff",
          boxShadow: shadow
            ? dark
              ? "0 0 0 1px rgba(255,255,255,.10), 0 40px 120px rgba(0,0,0,.55)"
              : "0 0 0 1px rgba(0,0,0,.07), 0 30px 90px rgba(0,0,0,.13), 0 8px 24px rgba(0,0,0,.05)"
            : "none",
        }}
      >
        <div style={{ position: "absolute", left: 0, top: 0, width: g.width, height: ch, borderBottom: `1px solid ${dark ? "#3a3a3c" : "#e5e5ea"}`, boxSizing: "border-box" }}>
          {["#ff5f57", "#febc2e", "#28c840"].map((col, i) => (
            <div key={col} style={{ position: "absolute", top: ch / 2 - ch * 0.14, left: ch * 0.5 + i * ch * 0.45, width: ch * 0.28, height: ch * 0.28, borderRadius: "50%", background: col }} />
          ))}
          {url ? (
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: ch * 0.19,
                height: ch * 0.62,
                width: g.width * 0.36,
                transform: "translateX(-50%)",
                borderRadius: ch * 0.18,
                background: dark ? "#3a3a3c" : "#f0f0f3",
                color: dark ? "#98989d" : "#6e6e73",
                fontFamily: FONT_UI,
                fontWeight: 500,
                fontSize: ch * 0.3,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                letterSpacing: "-0.005em",
                whiteSpace: "nowrap",
              }}
            >
              {url}
            </div>
          ) : null}
        </div>
        <div style={{ position: "absolute", left: 0, top: ch, width: g.width, height: sh }}>
          {screen}
        </div>
      </div>
    );
  }

  // Phone: neutral, unbranded device body.
  const bezel = phoneBezel(g.width);
  const status = PHONE_STATUS_CSS * g.s;
  const outerW = g.width + bezel * 2;
  const outerH = status + sh + bezel * 2;
  const outerR = g.width * 0.15;
  return (
    <div
      style={{
        position: "absolute",
        left: g.x - bezel,
        top: g.y - status - bezel,
        width: outerW,
        height: outerH,
        borderRadius: outerR,
        background: "linear-gradient(145deg, #2c2c2e 0%, #121214 45%, #1c1c1e 100%)",
        boxShadow: shadow
          ? "inset 0 0 0 1.5px rgba(255,255,255,.08), 0 0 0 1px rgba(0,0,0,.25), 0 40px 110px rgba(0,0,0,.25), 0 10px 30px rgba(0,0,0,.12)"
          : "none",
      }}
    >
      <div style={{ position: "absolute", left: bezel, top: bezel, width: g.width, height: status + sh, borderRadius: outerR - bezel, overflow: "hidden", background: c.bg }}>
        <StatusBar width={g.width} height={status} color={c.text} s={g.s} />
        <div style={{ position: "absolute", left: 0, top: status, width: g.width, height: sh }}>
          {screen}
        </div>
      </div>
    </div>
  );
};

const StatusBar: React.FC<{ width: number; height: number; color: string; s: number }> = ({ width, height, color, s }) => (
  <div style={{ position: "absolute", left: 0, top: 0, width, height, color, fontFamily: FONT_UI }}>
    <div style={{ position: "absolute", left: 34 * s, top: height * 0.38, fontSize: 16 * s, fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1 }}>10:30</div>
    <svg style={{ position: "absolute", right: 28 * s, top: height * 0.4, width: 68 * s, height: 13 * s }} viewBox="0 0 68 13" fill={color}>
      <rect x="0" y="8" width="3" height="5" rx="1" />
      <rect x="5" y="5.5" width="3" height="7.5" rx="1" />
      <rect x="10" y="3" width="3" height="10" rx="1" />
      <rect x="15" y="0.5" width="3" height="12.5" rx="1" />
      <path d="M30.5 3.2a9.4 9.4 0 0 1 12.6 0l-1.3 1.4a7.5 7.5 0 0 0-10 0zM33 5.9a5.8 5.8 0 0 1 7.6 0l-1.3 1.4a3.9 3.9 0 0 0-5 0zM35.6 8.6a2.1 2.1 0 0 1 2.4 0L36.8 10z" />
      <rect x="45.5" y="1" width="19" height="11" rx="3" fill="none" stroke={color} strokeOpacity=".4" />
      <rect x="47.2" y="2.7" width="15.6" height="7.6" rx="1.8" />
      <rect x="65.6" y="4.5" width="1.6" height="4" rx=".8" fillOpacity=".4" />
    </svg>
  </div>
);
