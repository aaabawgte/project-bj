import manifest from "../../public/captures/manifest.json";

export type Rect = { x: number; y: number; w: number; h: number };
export type Capture = { src: string; w: number; h: number; rects: Record<string, Rect> };
export type Profile = "desktop" | "mobile";

const M = manifest as unknown as Record<Profile, Record<string, Capture>>;

export function cap(profile: Profile, name: string): Capture {
  const c = M[profile][name];
  if (!c) throw new Error(`Missing capture ${profile}/${name}`);
  return c;
}

export function rect(profile: Profile, name: string, key: string): Rect {
  const r = cap(profile, name).rects[key];
  if (!r) throw new Error(`Missing rect ${key} in ${profile}/${name}`);
  return r;
}

export function center(r: Rect) {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

export function allCaptureSrcs(profile: Profile) {
  return Object.values(M[profile]).map(c => c.src);
}

export const VIEWPORT: Record<Profile, { w: number; h: number }> = {
  desktop: { w: 1440, h: 900 },
  mobile: { w: 430, h: 932 },
};
