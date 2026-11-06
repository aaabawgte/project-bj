import { Easing, interpolate } from "remotion";

// Apple-like curves: a smooth, symmetric in-out for camera moves and a long-tail
// ease-out for reveals. No springs, no overshoot.
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);
export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
export const easeIn = Easing.bezier(0.55, 0, 1, 0.45);

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** 0→1 progress between two frames with easing (clamped). */
export function prog(frame: number, from: number, to: number, ease = easeInOut) {
  if (to <= from) return frame >= to ? 1 : 0;
  return ease(clamp01((frame - from) / (to - from)));
}

/** Fade-in/hold/fade-out envelope. */
export function envelope(frame: number, inFrom: number, inTo: number, outFrom: number, outTo: number, ease = easeInOut) {
  return Math.min(prog(frame, inFrom, inTo, ease), 1 - prog(frame, outFrom, outTo, ease));
}

type Num = number;
export type Key<T> = [frame: number, value: T, ease?: (t: number) => number];

/** Keyframe track for numbers or flat numeric records; each segment eases into its key. */
export function track<T extends Num | Record<string, Num>>(frame: number, keys: Key<T>[]): T {
  if (frame <= keys[0][0]) return keys[0][1];
  const last = keys[keys.length - 1];
  if (frame >= last[0]) return last[1];
  let i = 0;
  while (frame > keys[i + 1][0]) i++;
  const [f0, v0] = keys[i];
  const [f1, v1, ease = easeInOut] = keys[i + 1];
  const t = ease(clamp01((frame - f0) / (f1 - f0)));
  if (typeof v0 === "number") return lerp(v0, v1 as number, t) as T;
  const out: Record<string, number> = {};
  for (const k of Object.keys(v0)) out[k] = lerp((v0 as any)[k], (v1 as any)[k], t);
  return out as T;
}

/** Last entry whose frame is <= current frame (for discrete UI states). */
export function step<T>(frame: number, keys: [number, T][]): { value: T; index: number; since: number } {
  let i = 0;
  while (i + 1 < keys.length && frame >= keys[i + 1][0]) i++;
  return { value: keys[i][1], index: i, since: frame - keys[i][0] };
}

export { interpolate };
