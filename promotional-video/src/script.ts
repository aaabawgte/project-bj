// The product-demo "shot list": which authentic capture is on screen at each frame, how the
// page is scrolled, where the camera looks and where the pointer goes. Pointer targets come
// from real element rects recorded during capture, so every click lands on the real control.
import { Key, easeInOut, easeOut, track } from "./lib/anim";
import { Profile, center, rect } from "./lib/captures";
import T from "./timeline.json";

export type Cam = { z: number; fx: number; fy: number; k: number; oy: number };
export type Pt = { x: number; y: number };

export type Script = {
  profile: Profile;
  contents: [frame: number, capture: string, fade: number][];
  scroll: Key<number>[];
  camera: Key<Cam>[];
  zoom: Key<Cam>[];
  pointer: Key<Pt>[]; // viewport CSS coords
  pointerVisible: [number, number][];
  clicks: number[];
  holds: [number, number][]; // pointer pressed (drag) ranges
  url: (capture: string) => string;
};

const BASE_URL = "aaabawgte.github.io/project-bj";

function urlFor(capture: string) {
  if (capture.startsWith("dashboard")) return `${BASE_URL}/pages/dashboard.html`;
  if (capture.startsWith("calc") || capture.startsWith("customer")) return `${BASE_URL}/pages/calculator.html`;
  if (capture.startsWith("stats")) return `${BASE_URL}/pages/warranty-stats.html`;
  if (capture.startsWith("shifts")) return `${BASE_URL}/pages/shift-requests.html?status=pending`;
  return BASE_URL;
}

/** Slider thumb centre for a native range input (min 2, max 36). */
export function thumb(profile: Profile, capture: string, key: string, value: number, scrollY: number): Pt {
  const r = rect(profile, capture, key);
  const t = (value - 2) / 34;
  // Chromium's thumb travels the track minus its own width (~16px).
  return { x: r.x + 8 + t * (r.w - 16), y: r.y + r.h / 2 - scrollY };
}

export const SLIDER = {
  calc: { from: 500, to: 540, v0: 12, v1: 24 },
  customer: { from: 602, to: 640, v0: 24, v1: 36 },
};

export function sliderValue(frame: number, s: { from: number; to: number; v0: number; v1: number }) {
  const t = easeInOut(Math.max(0, Math.min(1, (frame - s.from) / (s.to - s.from))));
  return Math.round(s.v0 + (s.v1 - s.v0) * t);
}

const ID: Cam = { z: 1, fx: 0, fy: 0, k: 0, oy: 0 };

export function buildScript(profile: Profile): Script {
  const d = profile === "desktop";
  const c = (cap: string, key: string, scrollY = 0): Pt => {
    const p = center(rect(profile, cap, key));
    return { x: p.x, y: p.y - scrollY };
  };
  const title = c("dashboard-light", "title");

  // Scroll positions (CSS px) for the calculator page, per layout.
  const S = d ? { totals: 560, slider: 940 } : { totals: 640, slider: 1060 };
  const statsScroll = d ? 300 : 770;
  const shiftsScroll = d ? 0 : 400;

  const contents: Script["contents"] = [
    [0, "dashboard-light", 0],
    ...(d ? ([[236, "dashboard-light-hover-calc", 0]] as Script["contents"]) : []),
    [262, "calc-00", 12],
    [310, "calc-01", 0],
    [315, "calc-02", 0],
    [320, "calc-03", 0],
    [325, "calc-04", 0],
    [350, "calc-05", 0],
    [355, "calc-06", 0],
    [374, "calc-07", 0],
    [394, "calc-08", 0],
    ...(d ? ([[406, "calc-09", 0]] as Script["contents"]) : []),
    [416, "calc-10", 0],
  ];
  for (let f = SLIDER.calc.from; f <= SLIDER.calc.to; f++) {
    const v = sliderValue(f, SLIDER.calc);
    const prev = contents[contents.length - 1][1];
    if (prev !== `calc-slider-${v}`) contents.push([f, `calc-slider-${v}`, 0]);
  }
  contents.push([556, "customer-24", 6]);
  for (let f = SLIDER.customer.from; f <= SLIDER.customer.to; f++) {
    const v = sliderValue(f, SLIDER.customer);
    const prev = contents[contents.length - 1][1];
    if (prev !== `customer-${v}`) contents.push([f, `customer-${v}`, 0]);
  }
  contents.push([650, "stats-light", 12]);
  contents.push([750, "shifts-2-week46", 12]);
  if (d) contents.push([808, "shifts-3-hover-approve", 0]);
  contents.push([826, "shifts-4-approved", 6]);

  const scroll: Key<number>[] = [
    [0, 0],
    [418, 0],
    [452, S.totals],
    [470, S.totals],
    [494, S.slider],
    [555, S.slider],
    [556, 0, () => 1],
    [664, 0],
    [730, statsScroll],
    [749, statsScroll],
    [750, shiftsScroll, () => 1],
  ];

  // Outer camera moves the whole device (intro match-cut, customer view framing).
  const zIntro = d ? 2.2 : 2.0;
  const custCam: Cam = d ? { z: 0.86, fx: 720, fy: 450, k: 1, oy: 96 } : { ...ID, fx: 215, fy: 400 };
  const camera: Key<Cam>[] = [
    [0, { z: zIntro, fx: title.x, fy: title.y, k: 1, oy: 0 }],
    [150, { z: zIntro, fx: title.x, fy: title.y, k: 1, oy: 0 }],
    [198, { ...ID, fx: title.x, fy: title.y }],
    [550, { ...ID, fx: custCam.fx, fy: custCam.fy }],
    [574, custCam],
    [646, custCam],
    [684, { ...ID, fx: custCam.fx, fy: custCam.fy }],
  ];

  // Inner zoom happens inside the screen (like a screen-recording zoom), so the
  // headline zone above the device always stays clean.
  // The phone is already shown large and the mobile layout has 16px gutters, so the phone
  // stays unzoomed (any zoom would crop the real page edges).
  const form = d ? { z: 1.5, fx: 470, k: 0.85 } : { z: 1, fx: 215, k: 0 };
  const Z = (fx: number, fy: number): Cam => ({ z: 1, fx, fy, k: 0, oy: 0 });
  const zoom: Key<Cam>[] = [
    [0, Z(d ? 470 : 215, 300)],
    [262, Z(d ? 470 : 215, 300)],
    [304, { z: form.z, fx: form.fx, fy: d ? 250 : 330, k: form.k, oy: 0 }],
    [412, { z: form.z, fx: form.fx, fy: d ? 470 : 520, k: form.k, oy: 0 }],
    [452, Z(form.fx, 500)],
    [480, Z(d ? 560 : 215, d ? 380 : 300)],
    [502, { z: d ? 1.3 : 1, fx: d ? 560 : 215, fy: d ? 380 : 300, k: d ? 0.6 : 0, oy: 0 }],
    [540, { z: d ? 1.3 : 1, fx: d ? 560 : 215, fy: d ? 420 : 330, k: d ? 0.6 : 0, oy: 0 }],
    [560, Z(d ? 560 : 215, d ? 420 : 330)],
    [760, Z(d ? 620 : 215, d ? 470 : 520)],
    [812, { z: d ? 1.16 : 1, fx: d ? 620 : 215, fy: d ? 480 : 520, k: d ? 0.35 : 0, oy: 0 }],
    [872, { z: d ? 1.2 : 1, fx: d ? 620 : 215, fy: d ? 480 : 520, k: d ? 0.35 : 0, oy: 0 }],
  ];

  const scrollAt = (f: number) => track(f, scroll);
  // Pointer path: element centres converted into viewport coords using the scroll at that frame.
  const at = (f: number, cap: string, key: string, dx = 0, dy = 0): Key<Pt> => {
    const p = c(cap, key, scrollAt(f));
    return [f, { x: p.x + dx, y: p.y + dy }];
  };
  const calcThumb = (f: number, v: number): Key<Pt> => [f, thumb(profile, "calc-10", "slider", v, scrollAt(f))];
  const custThumb = (f: number, v: number): Key<Pt> => [f, thumb(profile, "customer-24", "slider", v, 0)];

  const pointer: Key<Pt>[] = d
    ? [
        [196, { x: 760, y: 760 }],
        at(240, "dashboard-light", "calcTile", 14, 18),
        at(258, "dashboard-light", "calcTile", 14, 18),
        [292, { x: 640, y: 640 }],
        at(304, "calc-00", "price", -180, 2),
        at(330, "calc-00", "price", -180, 2),
        at(342, "calc-00", "discount", -140, 2),
        at(360, "calc-00", "discount", -140, 2),
        at(370, "calc-00", "group", -60, 2),
        at(380, "calc-00", "group", -60, 2),
        at(390, "calc-00", "warranty", -20, 2),
        at(396, "calc-00", "warranty", -20, 2),
        at(406, "calc-00", "addBtn", 30, 4),
        at(418, "calc-00", "addBtn", 30, 4),
        [446, { x: 1060, y: 520 }],
        [470, { x: 1060, y: 520 }],
        calcThumb(495, 12),
        ...Array.from({ length: 9 }, (_, i) => {
          const f = SLIDER.calc.from + (i * (SLIDER.calc.to - SLIDER.calc.from)) / 8;
          return calcThumb(f, SLIDER.calc.v0 + (SLIDER.calc.v1 - SLIDER.calc.v0) * easeInOut(i / 8));
        }),
        at(552, "calc-10", "customerBtn", 60, 4),
        at(560, "calc-10", "customerBtn", 60, 4),
        [578, { x: 760, y: 560 }],
        custThumb(598, 24),
        ...Array.from({ length: 9 }, (_, i) => {
          const f = SLIDER.customer.from + (i * (SLIDER.customer.to - SLIDER.customer.from)) / 8;
          return custThumb(f, SLIDER.customer.v0 + (SLIDER.customer.v1 - SLIDER.customer.v0) * easeInOut(i / 8));
        }),
        [660, { x: 1250, y: 560 }],
        [776, { x: 1180, y: 700 }],
        at(808, "shifts-2-week46", "approve", 6, 6),
        at(840, "shifts-2-week46", "approve", 6, 6),
        [868, { x: 1120, y: 720 }],
      ]
    : [
        // Phone: positions for touch indicators (taps & drags).
        at(250, "dashboard-light", "calcTile"),
        at(306, "calc-00", "price"),
        at(344, "calc-00", "discount"),
        at(372, "calc-00", "group"),
        at(392, "calc-00", "warranty"),
        at(414, "calc-00", "addBtn"),
        calcThumb(498, 12),
        ...Array.from({ length: 9 }, (_, i) => {
          const f = SLIDER.calc.from + (i * (SLIDER.calc.to - SLIDER.calc.from)) / 8;
          return calcThumb(f, SLIDER.calc.v0 + (SLIDER.calc.v1 - SLIDER.calc.v0) * easeInOut(i / 8));
        }),
        at(556, "calc-10", "customerBtn"),
        custThumb(600, 24),
        ...Array.from({ length: 9 }, (_, i) => {
          const f = SLIDER.customer.from + (i * (SLIDER.customer.to - SLIDER.customer.from)) / 8;
          return custThumb(f, SLIDER.customer.v0 + (SLIDER.customer.v1 - SLIDER.customer.v0) * easeInOut(i / 8));
        }),
        at(824, "shifts-2-week46", "approve"),
      ];

  return {
    profile,
    contents,
    scroll,
    camera,
    zoom,
    pointer: pointer.map(([f, v]) => [f, v, easeInOut] as Key<Pt>),
    pointerVisible: d
      ? [
          [196, 268],
          [292, 446],
          [470, 566],
          [578, 662],
          [776, 864],
        ]
      : [],
    clicks: T.audio.click,
    holds: [
      [498, 542],
      [600, 642],
    ],
    url: urlFor,
  };
}

export { easeOut };
