import React, { useMemo } from "react";
import { AbsoluteFill, Audio, staticFile, useCurrentFrame } from "remotion";
import { Device, DeviceGeometry, geometry, toComp, ScreenLayer, Theme } from "./components/Device";
import { FONT_UI, Fonts } from "./components/Fonts";
import { Headline, HeadlineSpec } from "./components/Headline";
import { Cursor, Touch } from "./components/Pointer";
import { clamp01, easeIn, easeInOut, easeOut, lerp, prog, track } from "./lib/anim";
import { cap, Profile, VIEWPORT } from "./lib/captures";
import { buildScript, Script } from "./script";

export type Format = "vertical" | "landscape";

type Layout = {
  W: number;
  H: number;
  vertical: boolean;
  profile: Profile;
  device: { left: number; top: number; width: number };
  headline: { top: number; size: number };
  wordmark: number;
};

const LAYOUTS: Record<Format, Layout> = {
  landscape: {
    W: 1920,
    H: 1080,
    vertical: false,
    profile: "desktop",
    device: { left: 220, top: 288, width: 1480 },
    headline: { top: 118, size: 72 },
    wordmark: 190,
  },
  vertical: {
    W: 1080,
    H: 1920,
    vertical: true,
    profile: "mobile",
    device: { left: 145, top: 560, width: 740 },
    headline: { top: 250, size: 84 },
    wordmark: 140,
  },
};

const HEADLINES: HeadlineSpec[] = [
  { from: 162, to: 262, primary: "Jedan pregled.", secondary: "Svi alati." },
  { from: 296, to: 452, primary: "Jamstva.", secondary: "Izračunata u sekundi." },
  { from: 464, to: 556, primary: "Mjesečna rata.", secondary: "Odmah izračunata." },
  { from: 568, to: 650, primary: "Prikaz za kupca.", secondary: "Jasan na prvi pogled." },
  { from: 662, to: 750, primary: "Svaka prodaja.", secondary: "Uvijek na vidiku." },
  { from: 762, to: 852, primary: "Smjene.", secondary: "Odobrene jednim klikom." },
  { from: 872, to: 948, primary: "Svijetlo ili tamno.", secondary: "Na svakom ekranu." },
];

export const Film: React.FC<{ format: Format; withAudio?: boolean }> = ({ format, withAudio = true }) => {
  const frame = useCurrentFrame();
  const L = LAYOUTS[format];
  const script = useMemo(() => buildScript(L.profile), [L.profile]);
  const darkness = prog(frame, 856, 886, easeInOut);

  return (
    <AbsoluteFill style={{ background: "#f5f5f7", overflow: "hidden" }}>
      <Fonts />
      <Backdrop darkness={darkness} />
      {frame >= 112 && frame < 886 ? <ProductDemo frame={frame} L={L} script={script} /> : null}
      {frame < 160 ? <Intro frame={frame} L={L} /> : null}
      {frame >= 856 && frame < 980 ? <Hero frame={frame} L={L} /> : null}
      {frame >= 950 ? <EndCard frame={frame} L={L} /> : null}
      {HEADLINES.map(h => (
        <Headline key={h.from} frame={frame} spec={h} vertical={L.vertical} dark={darkness} top={L.headline.top} size={L.headline.size} width={L.W} />
      ))}
      {withAudio ? <Audio src={staticFile("audio/soundtrack.wav")} /> : null}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------

const Backdrop: React.FC<{ darkness: number }> = ({ darkness }) => (
  <>
    <AbsoluteFill style={{ background: "radial-gradient(120% 90% at 50% 28%, #ffffff 0%, #f5f5f7 52%, #e9e9ee 100%)" }} />
    {darkness > 0 ? (
      <AbsoluteFill style={{ opacity: darkness, background: "radial-gradient(110% 80% at 50% 42%, #1a1a1d 0%, #0a0a0b 55%, #000 100%)" }} />
    ) : null}
  </>
);

// ---------------------------------------------------------------------------
// INTRO — the wordmark is set in the platform's own header type (Inter 800, -0.4px @ 28px)
// and shrinks into the exact position of the real dashboard's "PROJECT BJ" heading.

const WORD = "PROJECT BJ";

const Intro: React.FC<{ frame: number; L: Layout }> = ({ frame, L }) => {
  const g = deviceGeometry(L);
  const zIntro = L.vertical ? 2.0 : 2.2;
  const targetSize = 28 * g.s * zIntro;
  const morph = prog(frame, 112, 150, easeInOut);
  const scale = lerp(1, targetSize / L.wordmark, morph);
  const fadeOut = 1 - prog(frame, 146, 156, easeInOut);
  const tracking = lerp(0.06, -0.4 / 28, easeOut(clamp01((frame - 6) / 70)));
  if (fadeOut <= 0) return null;

  return (
    <AbsoluteFill style={{ opacity: fadeOut }}>
      <div
        style={{
          position: "absolute",
          left: L.W / 2,
          top: L.H / 2,
          transform: `translate(-50%, -50%) scale(${scale})`,
          fontFamily: FONT_UI,
          fontWeight: 800,
          fontSize: L.wordmark,
          lineHeight: 1.5,
          letterSpacing: `${tracking}em`,
          color: "#1c1c1e",
          whiteSpace: "nowrap",
          display: "flex",
        }}
      >
        {WORD.split("").map((ch, i) => {
          const t = easeOut(clamp01((frame - 8 - i * 2.4) / 30));
          return (
            <span key={i} style={{ display: "inline-block", overflow: "hidden", lineHeight: 1.5 }}>
              <span
                style={{
                  display: "inline-block",
                  transform: `translateY(${(1 - t) * 70}%)`,
                  opacity: t,
                  filter: t < 1 ? `blur(${(1 - t) * 10}px)` : undefined,
                  whiteSpace: "pre",
                }}
              >
                {ch}
              </span>
            </span>
          );
        })}
      </div>
      <Headline
        frame={frame}
        spec={{ from: 44, to: 114, primary: "Sve što prodajni tim treba.", secondary: "Na jednom mjestu." }}
        vertical={L.vertical}
        top={L.H / 2 + L.wordmark * (L.vertical ? 0.62 : 0.6)}
        size={L.vertical ? 58 : 46}
        width={L.W}
      />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// PRODUCT DEMO — one persistent device; authentic captures swap inside it.

function deviceGeometry(L: Layout): DeviceGeometry {
  const vp = VIEWPORT[L.profile];
  return geometry(L.vertical ? "phone" : "browser", L.device.left, L.device.top, L.device.width, vp.w, vp.h);
}

function cameraTransform(L: Layout, g: DeviceGeometry, cam: { z: number; fx: number; fy: number; k: number; oy: number }) {
  const P = toComp(g, cam.fx, cam.fy);
  const Tx = lerp(P.x, L.W / 2, cam.k);
  const Ty = lerp(P.y, L.H / 2 + cam.oy, cam.k);
  return `translate(${Tx - P.x * cam.z}px, ${Ty - P.y * cam.z}px) scale(${cam.z})`;
}

/** Zoom inside the screen around viewport point (fx, fy); k pulls it toward the visible centre. */
function innerZoom(g: DeviceGeometry, c: { z: number; fx: number; fy: number; k: number }, visH: number) {
  if (Math.abs(c.z - 1) < 1e-4) return undefined;
  const tx = lerp(c.fx, g.vw / 2, c.k);
  const ty = lerp(c.fy, visH / 2, c.k);
  // Keep the page covering the screen (no empty margins at the edges).
  const dx = Math.min(0, Math.max(g.vw * (1 - c.z), tx - c.fx * c.z));
  const dy = Math.min(0, ty - c.fy * c.z);
  return `translate(${dx * g.s}px, ${dy * g.s}px) scale(${c.z})`;
}

const ProductDemo: React.FC<{ frame: number; L: Layout; script: Script }> = ({ frame, L, script }) => {
  const g = deviceGeometry(L);
  const { contents } = script;
  let i = 0;
  while (i + 1 < contents.length && frame >= contents[i + 1][0]) i++;
  const [start, name, fade] = contents[i];
  const fadeT = fade > 0 ? easeInOut(clamp01((frame - start) / fade)) : 1;
  const scrollAt = (f: number) => track(f, script.scroll);

  const layers: ScreenLayer[] = [];
  if (fadeT < 1 && i > 0) layers.push({ src: cap(L.profile, contents[i - 1][1]).src, scrollY: scrollAt(start - 1), opacity: 1 });
  layers.push({ src: cap(L.profile, name).src, scrollY: scrollAt(frame), opacity: fadeT });

  const cam = track(frame, script.camera);
  const zm = track(frame, script.zoom);
  const visH = Math.min(g.vh, (L.H - g.y) / g.s);
  const inner = innerZoom(g, zm, visH);
  const appear = prog(frame, 116, 146, easeInOut);
  const exit = prog(frame, 856, 884, easeIn);
  const opacity = appear * (1 - exit);

  // Pointer (desktop) or touches (phone)
  const p = track(frame, script.pointer);
  let overlay: React.ReactNode = null;
  if (!L.vertical) {
    let vis = 0;
    for (const [a, b] of script.pointerVisible) vis = Math.max(vis, Math.min(prog(frame, a, a + 8), 1 - prog(frame, b - 8, b)));
    let press = 0;
    let ring = 0;
    for (const c of script.clicks) {
      const d = frame - c;
      if (d >= -2 && d <= 6) press = Math.max(press, d < 0 ? (d + 2) / 2 : 1 - clamp01((d - 2) / 4));
      if (d >= 0 && d < 16) ring = d / 16;
    }
    for (const [a, b] of script.holds) if (frame >= a && frame <= b) press = Math.max(press, Math.min(1, (frame - a) / 2, (b - frame) / 2));
    overlay = <Cursor x={p.x} y={p.y} opacity={vis} press={press} ring={ring} />;
  } else {
    const nodes: React.ReactNode[] = [];
    for (const c of script.clicks) {
      const t = (frame - c) / 18;
      if (t > 0 && t < 1 && !script.holds.some(([a]) => a === c)) {
        const q = track(c, script.pointer);
        nodes.push(<Touch key={c} x={q.x} y={q.y} t={t} />);
      }
    }
    for (const [a, b] of script.holds) {
      if (frame >= a - 3 && frame <= b + 8) {
        const t = frame < a ? 0.1 : frame > b ? 0.45 + ((frame - b) / 8) * 0.55 : 0.3;
        nodes.push(<Touch key={`h${a}`} x={p.x} y={p.y} t={t} hold={frame >= a && frame <= b} />);
      }
    }
    overlay = <>{nodes}</>;
  }

  // Match-cut: hide the real heading until the intro wordmark lands exactly on top of it.
  const maskO = 1 - prog(frame, 146, 154, easeInOut);
  if (maskO > 0) {
    const t = cap(L.profile, "dashboard-light").rects.title;
    overlay = (
      <>
        {overlay}
        <div style={{ position: "absolute", left: t.x - 4, top: t.y, width: t.w + 8, height: t.h, background: "#f5f5f7", opacity: maskO }} />
      </>
    );
  }

  return (
    <AbsoluteFill
      style={{
        opacity,
        transform: `translateY(${-exit * 30}px) scale(${1 - exit * 0.06})`,
        filter: exit > 0.01 ? `blur(${exit * 12}px)` : undefined,
      }}
    >
      <AbsoluteFill style={{ transform: cameraTransform(L, g, cam), transformOrigin: "0 0" }}>
        <Device g={g} layers={layers} theme="light" url={script.url(name)} overlay={overlay} shadow={appear > 0.5} innerTransform={inner} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// HERO — real light & dark captures composed in depth.

type HeroItem = {
  kind: "browser" | "phone";
  capture: string;
  theme: Theme;
  left: number;
  top: number;
  width: number;
  rotY: number;
  z: number;
  delay: number;
  scroll?: number;
};

const HERO: Record<Format, HeroItem[]> = {
  landscape: [
    { kind: "browser", capture: "warranties-light-view", theme: "light", left: -60, top: 340, width: 940, rotY: 24, z: -300, delay: 8 },
    { kind: "browser", capture: "calc-dark-view", theme: "dark", left: 1040, top: 340, width: 940, rotY: -24, z: -300, delay: 8 },
    { kind: "browser", capture: "dashboard-dark", theme: "dark", left: 380, top: 290, width: 1160, rotY: 0, z: 0, delay: 0 },
    { kind: "phone", capture: "dashboard-light", theme: "light", left: 250, top: 520, width: 270, rotY: 10, z: 160, delay: 16 },
    { kind: "phone", capture: "customer-dark-24", theme: "dark", left: 1400, top: 520, width: 270, rotY: -10, z: 160, delay: 16 },
  ],
  vertical: [
    { kind: "phone", capture: "stats-light-view", theme: "light", left: -90, top: 760, width: 470, rotY: 26, z: -280, delay: 8 },
    { kind: "phone", capture: "customer-dark-24", theme: "dark", left: 670, top: 760, width: 470, rotY: -26, z: -280, delay: 8 },
    { kind: "phone", capture: "dashboard-dark", theme: "dark", left: 230, top: 620, width: 580, rotY: 0, z: 0, delay: 0 },
  ],
};

const Hero: React.FC<{ frame: number; L: Layout }> = ({ frame, L }) => {
  const items = HERO[L.vertical ? "vertical" : "landscape"];
  const exit = prog(frame, 948, 976, easeIn);
  const drift = prog(frame, 858, 980, (t: number) => t);
  return (
    <AbsoluteFill
      style={{
        opacity: 1 - exit,
        filter: exit > 0.01 ? `blur(${exit * 14}px)` : undefined,
        transform: `scale(${(0.975 + drift * 0.045) * (1 - exit * 0.04)})`,
      }}
    >
      {items.map(it => {
        const profile: Profile = it.kind === "browser" ? "desktop" : "mobile";
        const vp = VIEWPORT[profile];
        const kindGeom = it.kind;
        const g = geometry(kindGeom, it.left, it.top, it.width, vp.w, vp.h);
        const t = easeOut(clamp01((frame - 860 - it.delay) / 36));
        const cx = it.left + it.width / 2;
        const cy = it.top + 400;
        return (
          <AbsoluteFill
            key={it.capture + it.left}
            style={{
              opacity: t,
              transformOrigin: `${cx}px ${cy}px`,
              transform: `perspective(2400px) translateY(${(1 - t) * 140}px) translateZ(${it.z - (1 - t) * 220}px) rotateY(${it.rotY * (0.75 + 0.25 * t)}deg) rotateX(${(1 - t) * 8}deg)`,
            }}
          >
            <Device
              g={g}
              layers={[{ src: cap(profile, it.capture).src, scrollY: it.scroll ?? 0, opacity: 1 }]}
              theme={it.theme}
              url={it.kind === "browser" ? `aaabawgte.github.io/project-bj/pages/${it.capture.startsWith("stats") ? "warranty-stats" : it.capture.startsWith("warranties") ? "warranties" : it.capture.startsWith("calc") ? "calculator" : "dashboard"}.html` : undefined}
            />
          </AbsoluteFill>
        );
      })}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// END CARD

const EndCard: React.FC<{ frame: number; L: Layout }> = ({ frame, L }) => {
  const v = L.vertical;
  const size = v ? 150 : 176;
  const cy = v ? 800 : 440;
  const settle = prog(frame, 960, 1040, (t: number) => t);
  const tag = easeOut(clamp01((frame - 978) / 28));
  const cta = easeOut(clamp01((frame - 990) / 28));
  const url = easeOut(clamp01((frame - 998) / 28));

  return (
    <AbsoluteFill style={{ transform: `scale(${1 + settle * 0.015})` }}>
      <div
        style={{
          position: "absolute",
          left: L.W / 2,
          top: cy,
          transform: "translate(-50%, -50%)",
          fontFamily: FONT_UI,
          fontWeight: 800,
          fontSize: size,
          lineHeight: 1.2,
          letterSpacing: `${-0.4 / 28}em`,
          color: "#f5f5f7",
          display: "flex",
          whiteSpace: "nowrap",
        }}
      >
        {WORD.split("").map((ch, i) => {
          const t = easeOut(clamp01((frame - 962 - i * 2.2) / 30));
          return (
            <span key={i} style={{ display: "inline-block", overflow: "hidden" }}>
              <span style={{ display: "inline-block", whiteSpace: "pre", transform: `translateY(${(1 - t) * 80}%)`, opacity: t, filter: t < 1 ? `blur(${(1 - t) * 10}px)` : undefined }}>
                {ch}
              </span>
            </span>
          );
        })}
      </div>

      <div
        style={{
          position: "absolute",
          top: cy + size * (v ? 0.66 : 0.6),
          width: L.W,
          textAlign: "center",
          fontFamily: `"Inter Display Film", "Inter Film", sans-serif`,
          fontWeight: 600,
          fontSize: v ? 58 : 50,
          letterSpacing: "-0.022em",
          opacity: tag,
          transform: `translateY(${(1 - tag) * 24}px)`,
          filter: tag < 1 ? `blur(${(1 - tag) * 10}px)` : undefined,
        }}
      >
        <span style={{ color: "#f5f5f7" }}>Prodaja. </span>
        <span style={{ color: "#86868b" }}>Pojednostavljena.</span>
      </div>

      <div
        style={{
          position: "absolute",
          top: cy + size * (v ? 1.42 : 1.3),
          left: L.W / 2,
          transform: `translate(-50%, ${(1 - cta) * 20}px)`,
          opacity: cta,
          minHeight: v ? 84 : 66,
          padding: v ? "0 46px" : "0 36px",
          display: "flex",
          alignItems: "center",
          borderRadius: v ? 20 : 16,
          background: "#0a84ff",
          color: "#fff",
          fontFamily: FONT_UI,
          fontWeight: 700,
          fontSize: v ? 34 : 27,
          letterSpacing: "-0.01em",
          whiteSpace: "nowrap",
        }}
      >
        Prijavi se
      </div>

      <div
        style={{
          position: "absolute",
          top: cy + size * (v ? 2.1 : 1.95),
          width: L.W,
          textAlign: "center",
          fontFamily: FONT_UI,
          fontWeight: 500,
          fontSize: v ? 34 : 27,
          color: "#86868b",
          letterSpacing: "-0.005em",
          opacity: url,
          transform: `translateY(${(1 - url) * 16}px)`,
        }}
      >
        aaabawgte.github.io/project-bj
      </div>
    </AbsoluteFill>
  );
};
