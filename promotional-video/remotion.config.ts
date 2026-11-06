import { Config } from "@remotion/cli/config";

// Use the locally installed Chromium headless shell when present (no download needed).
// Override with REMOTION_BROWSER=/path/to/chrome if your machine differs.
import fs from "node:fs";
const local = process.env.REMOTION_BROWSER ?? "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
if (fs.existsSync(local)) Config.setBrowserExecutable(local);

Config.setVideoImageFormat("png");
Config.setChromiumOpenGlRenderer("swangle");
Config.setDelayRenderTimeoutInMilliseconds(120000);
