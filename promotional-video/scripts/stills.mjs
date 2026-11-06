// QA helper: renders selected frames of both compositions to PNG.
// Usage: node scripts/stills.mjs <outDir> <frames comma-separated> [vertical|landscape|both]
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import fs from "node:fs";
import path from "node:path";

const [outDir, framesArg, which = "both"] = process.argv.slice(2);
const frames = framesArg.split(",").map(Number);
const browserExecutable = "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
fs.mkdirSync(outDir, { recursive: true });
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const ids = which === "both" ? ["ProjectBJVertical", "ProjectBJLandscape"] : [which === "vertical" ? "ProjectBJVertical" : "ProjectBJLandscape"];
for (const id of ids) {
  const inputProps = { format: id.includes("Vertical") ? "vertical" : "landscape", withAudio: false };
  const composition = await selectComposition({ serveUrl, id, inputProps, browserExecutable });
  for (const frame of frames) {
    const output = path.join(outDir, `${id.includes("Vertical") ? "v" : "l"}-${String(frame).padStart(4, "0")}.png`);
    await renderStill({ composition, serveUrl, frame, output, inputProps, browserExecutable, chromiumOptions: { gl: "swangle" }, scale: Number(process.env.SCALE || 0.5) });
    console.log(output);
  }
}
