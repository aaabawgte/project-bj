// Captures authentic, high-DPI screenshots of the REAL Project BJ frontend.
//
//  - Serves the repository's unmodified index.html / pages / css / js locally.
//  - Answers API calls with demo fixtures (see mock-api.mjs) — production is never contacted.
//  - Drives real interactions (typing, selects, clicks, sliders, theme) with Playwright and
//    screenshots every resulting state. Element rects are stored in a manifest so the video
//    can aim its camera and cursor at real UI elements.
//
// Usage: node capture/capture.mjs
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startServer } from "./server.mjs";
import { mockApi } from "./mock-api.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(here, "../public/captures");
const BASE = "http://127.0.0.1:4173";

const PROFILES = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 },
  mobile: { viewport: { width: 430, height: 932 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
};

const manifest = {};

async function newPage(browser, profileName, { theme = "light" } = {}) {
  const context = await browser.newContext({
    ...PROFILES[profileName],
    locale: "hr-HR",
    timezoneId: "Europe/Zagreb",
  });
  await context.clock.setFixedTime(new Date("2026-11-06T10:30:00+01:00"));
  await mockApi(context);
  await context.addInitScript(t => {
    localStorage.setItem("token", "demo-token");
    localStorage.setItem("username", "Ana");
    localStorage.setItem("role", "admin");
    localStorage.setItem("user", JSON.stringify({ id: 1, username: "Ana", role: "admin" }));
    localStorage.setItem("theme", t);
  }, theme);
  const page = await context.newPage();
  page.on("pageerror", e => console.warn(`[pageerror ${profileName}]`, e.message));
  page.on("dialog", d => (d.type() === "prompt" ? d.accept("") : d.accept()));
  return page;
}

async function open(page, url) {
  await page.goto(`${BASE}/${url}`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(1, 1);
  await settle(page);
}

const settle = page => page.waitForTimeout(450); // lets the app's .22s softFadeUp finish

async function rects(page, selectors, fullPage) {
  return page.evaluate(([sels, fp]) => {
    const out = {};
    for (const [key, sel] of Object.entries(sels)) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      // Full-page shots: document coordinates. Viewport shots: viewport coordinates.
      out[key] = fp
        ? { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height }
        : { x: r.left, y: r.top, w: r.width, h: r.height };
    }
    return out;
  }, [selectors, fullPage]);
}

async function shot(page, profile, name, { fullPage = false, selectors = {} } = {}) {
  const dir = path.join(OUT, profile);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${name}.png`);
  await page.screenshot({ path: file, fullPage, animations: "disabled" });
  const size = await page.evaluate(fp => ({
    w: document.documentElement.clientWidth,
    h: fp ? document.documentElement.scrollHeight : innerHeight,
  }), fullPage);
  manifest[profile] ??= {};
  manifest[profile][name] = { src: `captures/${profile}/${name}.png`, ...size, rects: await rects(page, selectors, fullPage) };
  console.log(`  ${profile}/${name}  ${size.w}x${size.h}`);
}

async function hoverEl(page, sel) {
  const box = await page.locator(sel).first().boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(220);
}

// ---------------------------------------------------------------------------

const CALC_SELECTORS = {
  price: "#price",
  discount: "#discount",
  group: "#group",
  warranty: "#warranty",
  addBtn: "#product-form button[type=submit]",
  formCard: ".form-card",
  products: ".products-card",
  totals: ".totals-card",
  grandTotal: "#grand-total",
  installments: ".installments-card",
  slider: "#installments",
  customerBtn: "#customer-view-btn",
  groups: ".groups-card",
};

async function captureDashboard(browser, profile) {
  for (const theme of ["light", "dark"]) {
    const page = await newPage(browser, profile, { theme });
    await open(page, "pages/dashboard.html");
    const selectors = {
      grid: ".dashboard-grid",
      calcTile: '[data-tool="calculator"] .tool-card',
      warrantiesTile: '[data-tool="warranties"] .tool-card',
      statsTile: '[data-tool="warranty-stats"] .tool-card',
      shiftsTile: '[data-tool="shifts"] .tool-card',
      sidebar: ".dashboard-sidebar",
      announcements: ".announcements-card",
      themeToggle: "#theme-toggle",
      title: "h1",
    };
    await shot(page, profile, `dashboard-${theme}`, { selectors });
    if (profile === "mobile") await shot(page, profile, `dashboard-${theme}-full`, { fullPage: true, selectors });
    if (theme === "light") {
      await hoverEl(page, '[data-tool="calculator"] .tool-card');
      await shot(page, profile, "dashboard-light-hover-calc", { selectors });
    }
    await page.context().close();
  }
}

async function captureCalculator(browser, profile) {
  const page = await newPage(browser, profile);
  await open(page, "pages/calculator.html");
  const full = { fullPage: true, selectors: CALC_SELECTORS };
  let i = 0;
  const step = async () => shot(page, profile, `calc-${String(i++).padStart(2, "0")}`, full);

  await step(); // empty form
  await page.click("#price");
  for (const ch of "1299") {
    await page.keyboard.type(ch);
    await step();
  }
  await page.click("#discount"); // blur → real formatter turns 1299 into 1.299,00
  for (const ch of "10") {
    await page.keyboard.type(ch);
    await step();
  }
  await page.selectOption("#group", "A");
  await page.focus("#group");
  await step();
  await page.selectOption("#warranty", "5"); // 5+2 god + zaštita od oštećenja 7 god (26%)
  await page.focus("#warranty");
  await step();
  await hoverEl(page, "#product-form button[type=submit]");
  await step();
  await page.click("#product-form button[type=submit]");
  await page.mouse.move(1, 1);
  await page.locator("#price").blur();
  await settle(page);
  await step(); // product row + totals + customer copy text

  // Installment slider – drive the real range input through its real input handler.
  for (let v = 12; v <= 36; v++) {
    await page.$eval("#installments", (el, val) => {
      el.value = String(val);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, v);
    await shot(page, profile, `calc-slider-${v}`, full);
  }
  await page.$eval("#installments", el => {
    el.value = "24";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });

  // Customer view (fixed full-screen overlay) – viewport captures.
  await page.locator("#customer-view-btn").scrollIntoViewIfNeeded();
  await hoverEl(page, "#customer-view-btn");
  await shot(page, profile, "calc-customer-btn-hover", { selectors: CALC_SELECTORS });
  await page.click("#customer-view-btn");
  await page.mouse.move(1, 1);
  await settle(page);
  const cvSel = {
    content: ".customer-view-content",
    pill: "#customer-installments",
    slider: "#customer-installments-slider",
    total: "#customer-total",
    diff: ".customer-highlight",
  };
  for (let v = 12; v <= 36; v++) {
    await page.$eval("#customer-installments-slider", (el, val) => {
      el.value = String(val);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, v);
    await shot(page, profile, `customer-${v}`, { selectors: cvSel });
  }
  await page.context().close();
}

// Dark theme: same real workflow, only the finished states are kept (used in the hero shot).
async function captureCalculatorDark(browser, profile) {
  const page = await newPage(browser, profile, { theme: "dark" });
  await open(page, "pages/calculator.html");
  await page.fill("#price", "1299");
  await page.fill("#discount", "10");
  await page.selectOption("#group", "A");
  await page.selectOption("#warranty", "5");
  await page.click("#product-form button[type=submit]");
  await page.locator("#price").blur();
  await page.mouse.move(1, 1);
  await settle(page);
  await shot(page, profile, "calc-dark", { fullPage: true, selectors: CALC_SELECTORS });
  await page.evaluate(y => window.scrollTo(0, y), profile === "desktop" ? 560 : 640);
  await page.waitForTimeout(150);
  await shot(page, profile, "calc-dark-view", {});
  await page.click("#customer-view-btn");
  await page.mouse.move(1, 1);
  await settle(page);
  await page.$eval("#customer-installments-slider", el => {
    el.value = "24";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await shot(page, profile, "customer-dark-24", {});
  await page.context().close();
}

async function captureStats(browser, profile) {
  for (const theme of ["light", "dark"]) {
    const page = await newPage(browser, profile, { theme });
    await open(page, "pages/warranty-stats.html");
    await shot(page, profile, `stats-${theme}`, {
      fullPage: true,
      selectors: { tiles: ".stats-grid", chart: ".pie-chart", chartCard: ".stats-section", byUser: ".stats-section:nth-of-type(3)" },
    });
    // Viewport-sized capture for the 3D hero shot (oversized textures don't composite well in 3D).
    await page.evaluate(y => window.scrollTo(0, y), profile === "desktop" ? 300 : 0);
    await page.waitForTimeout(150);
    await shot(page, profile, `stats-${theme}-view`, {});
    await page.context().close();
  }
}

async function captureWarranties(browser, profile) {
  for (const theme of ["light", "dark"]) {
    const page = await newPage(browser, profile, { theme });
    await open(page, "pages/warranties.html");
    await shot(page, profile, `warranties-${theme}`, {
      fullPage: true,
      selectors: { summary: ".warranties-summary", list: ".warranties-list", first: ".warranty-row", newBtn: "#new-warranty-btn" },
    });
    await shot(page, profile, `warranties-${theme}-view`, {});
    await page.context().close();
  }
}

async function captureShifts(browser, profile) {
  const page = await newPage(browser, profile);
  await open(page, "pages/shift-requests.html?status=pending");
  const selectors = {
    filter: ".week-filter-card",
    next: "#next-week",
    list: "#requests-container",
    firstCard: ".shift-request-card",
    approve: ".approve-btn",
  };
  await shot(page, profile, "shifts-0-week45", { fullPage: true, selectors });
  if (profile === "desktop") {
    await hoverEl(page, "#next-week");
    await shot(page, profile, "shifts-1-hover-next", { fullPage: true, selectors });
    await page.click("#next-week");
  } else {
    // On a 430px phone the Croatian week label pushes "Sljedeći" off-card, so pick the
    // week through the native picker's real change handler instead.
    await page.$eval("#week-filter", el => {
      el.value = "2026-W46";
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }
  await page.mouse.move(1, 1);
  await settle(page);
  await shot(page, profile, "shifts-2-week46", { fullPage: true, selectors });
  await hoverEl(page, ".approve-btn");
  await shot(page, profile, "shifts-3-hover-approve", { fullPage: true, selectors });
  await page.click(".approve-btn"); // real prompt + alert, accepted by the dialog handler
  await page.mouse.move(1, 1);
  await page.waitForTimeout(400);
  await settle(page);
  await shot(page, profile, "shifts-4-approved", { fullPage: true, selectors });
  await page.context().close();

  const hub = await newPage(browser, profile);
  await open(hub, "pages/shifts.html");
  await shot(hub, profile, "shifts-hub", { selectors: { grid: ".shifts-grid" } });
  await hub.context().close();
}

async function captureNotes(browser, profile) {
  const page = await newPage(browser, profile);
  await open(page, "pages/notes.html");
  await shot(page, profile, "notes-light", { fullPage: profile === "mobile", selectors: { grid: ".notes-grid" } });
  await page.context().close();
}

async function captureLogin(browser, profile) {
  for (const theme of ["light", "dark"]) {
    const page = await newPage(browser, profile, { theme });
    await page.addInitScript(() => localStorage.removeItem("token"));
    await open(page, "index.html");
    await shot(page, profile, `login-${theme}`, { selectors: { card: ".login-card" } });
    await page.context().close();
  }
}

function findFullChromium() {
  const root = "/opt/pw-browsers";
  if (!fs.existsSync(root)) return undefined; // fall back to Playwright's default browser
  for (const dir of fs.readdirSync(root).filter(d => /^chromium-\d+$/.test(d))) {
    for (const sub of fs.readdirSync(path.join(root, dir))) {
      const exe = path.join(root, dir, sub, "chrome");
      if (fs.existsSync(exe)) return exe;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------

fs.rmSync(OUT, { recursive: true, force: true });
const server = await startServer();
// Full Chromium (not the headless shell) so native controls such as the week picker render
// in Croatian, exactly as they do for the platform's Croatian users.
const browser = await chromium.launch({
  executablePath: process.env.CAPTURE_CHROME || findFullChromium(),
  args: ["--lang=hr"],
  env: { ...process.env, LANGUAGE: "hr", LANG: "hr_HR.UTF-8" },
});
try {
  for (const profile of Object.keys(PROFILES)) {
    console.log(`\n[${profile}]`);
    await captureLogin(browser, profile);
    await captureDashboard(browser, profile);
    await captureCalculator(browser, profile);
    await captureCalculatorDark(browser, profile);
    await captureStats(browser, profile);
    await captureWarranties(browser, profile);
    await captureShifts(browser, profile);
    await captureNotes(browser, profile);
  }
  fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log("\nmanifest written");
} finally {
  await browser.close();
  server.close();
}
