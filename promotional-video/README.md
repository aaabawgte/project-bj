# Project BJ — promotional film

A ~35-second, Apple-style product film for **Project BJ**, built programmatically with
[Remotion](https://www.remotion.dev/) from **authentic captures of the real application**.

| Deliverable | File |
| --- | --- |
| Vertical (Reels / TikTok / Shorts), 1080×1920, 30 fps, H.264 + AAC | `out/project-bj-vertical-1080x1920.mp4` |
| Landscape, 1920×1080, 30 fps, H.264 + AAC | `out/project-bj-landscape-1920x1080.mp4` |

This directory is fully isolated: nothing in the platform (`index.html`, `pages/`, `css/`, `js/`,
`worker/`) was modified.

## How the UI stays 100% authentic

The film never redraws the interface. Every screen is a high-DPI screenshot of the real,
unmodified frontend:

1. `capture/server.mjs` serves the repository root (the actual production HTML/CSS/JS).
2. `capture/mock-api.mjs` intercepts calls to the production worker URL inside Playwright and
   answers them locally with demo data (`capture/fixtures.mjs`) in the **exact JSON shape** that
   `worker/worker.js` returns. Production is never contacted; no real accounts or user data are used.
   All names are fictional.
3. `capture/capture.mjs` drives real interactions with Playwright — typing a price, entering a
   discount, choosing product group and warranty, clicking *Dodaj proizvod*, dragging the
   installment sliders through the app's own `input` handlers, opening *Prikaz za kupca*, moving to
   the next schedule week and approving a shift request — and screenshots every resulting state.
   - Desktop: 1440×900 viewport @2x (2880 px wide images).
   - Mobile: 430×932 viewport @3x (1290 px wide images), using the app's real responsive layout.
   - Light and dark themes via the app's own `theme` setting.
   - Full Chromium with Croatian browser language (`--lang=hr`), so native controls such as the
     week picker read "46. tjedan, 2026. godina" exactly as they do for the platform's users.
     (On a 430px phone that Croatian label pushes the "Sljedeći →" button past the card edge, so
     the mobile capture selects the week through the picker's real `change` handler and the
     vertical film frames the request cards instead. The UI itself was not altered.)
4. Element rectangles are written to `public/captures/manifest.json`, so camera moves, zooms and
   the pointer target real controls.

In the video the captures are only transformed as whole layers (scale, pan, crop, crossfade) —
never retouched. Frame sequences (typing, slider positions, approval) play back like a screen
recording.

## Structure

```
capture/        Playwright capture pipeline (server, API mock, fixtures, capture script)
public/
  captures/     Authentic screenshots + manifest.json (generated)
  audio/        soundtrack.wav (generated, original)
  fonts/        Inter / Inter Display (SIL OFL 1.1, see LICENSE-Inter.txt)
scripts/
  make_audio.py Original sound design synthesized with numpy, synced to src/timeline.json
  stills.mjs    QA helper: render selected frames to PNG
                (node scripts/stills.mjs <outDir> 120,300,600 [vertical|landscape|both])
src/
  timeline.json Scene timing + audio cue frames (shared by video and audio)
  script.ts     Shot list: captures per frame, scrolling, camera, pointer paths
  Film.tsx      Intro match-cut, product demo, hero, end card; both formats
  components/   Device (browser window / phone), Headline, Cursor/Touch, Fonts
  lib/          Easing/keyframe helpers, capture manifest access
```

## Rendering

Requirements: Node 18+, Python 3 with numpy, a Chromium (Remotion downloads one automatically;
`remotion.config.ts` uses a local headless shell if present), and FFmpeg is bundled by Remotion.

```bash
cd promotional-video
npm install

npm run capture          # optional: re-capture the real app (needs Playwright + Chromium)
npm run audio            # optional: regenerate the soundtrack
npm run render           # renders both MP4s into out/
# or individually:
npm run render:vertical
npm run render:landscape

npm run studio           # interactive preview / editing in Remotion Studio
```

Copy lives in `HEADLINES` and the `Intro` / `EndCard` components in `src/Film.tsx`.
Timing lives in `src/timeline.json` and `src/script.ts`. Change both together and re-run
`npm run audio` so sound cues stay in sync.

## What the film shows (all real features)

1. **Intro** — the wordmark is set in the platform's own header type (Inter 800) and lands exactly
   on the real dashboard's "PROJECT BJ" heading (match cut).
2. **Dashboard** — tool tiles, logged-in user, announcements.
3. **Kalkulator jamstava** — price 1.299,00 €, 10 % discount, Grupa A, *Produženo održavanje
   5+2 god + zaštita od oštećenja 7 god (26 %)*; warranty is calculated on the full price
   before discount (337,74 €), totals 1.506,84 €; installment slider 12 → 24.
4. **Prikaz za kupca** — the customer-facing installment view, slider 24 → 36.
5. **Statistika jamstava** — summary tiles and the by-type donut chart.
6. **Zahtjevi za smjene** — an admin approves a pending shift request.
7. **Hero** — real light and dark theme captures, desktop and mobile.
8. **End card** — wordmark, tagline, login CTA and the real URL `aaabawgte.github.io/project-bj`.

All on-screen copy is Croatian.
