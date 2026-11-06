// Intercepts every request the real frontend makes to the production worker URL
// and answers it locally with fixture data in the worker's exact response format.
import * as fx from "./fixtures.mjs";

export const API = "https://project-bj-api.aaabawgte.workers.dev";

// Same ISO-week → date range logic as GET /shift-requests in worker/worker.js
function weekRange(value) {
  const [yearText, weekText] = value.split("-W");
  const firstDay = new Date(Date.UTC(Number(yearText), 0, 1 + (Number(weekText) - 1) * 7));
  const day = firstDay.getUTCDay() || 7;
  if (day <= 4) firstDay.setUTCDate(firstDay.getUTCDate() - day + 1);
  else firstDay.setUTCDate(firstDay.getUTCDate() + 8 - day);
  const lastDay = new Date(firstDay);
  lastDay.setUTCDate(firstDay.getUTCDate() + 6);
  return [firstDay.toISOString().slice(0, 10), lastDay.toISOString().slice(0, 10)];
}

export async function mockApi(context, { role = "admin" } = {}) {
  // Per-context mutable copy so real interactions (approve a request) persist.
  const shiftRequests = structuredClone(fx.shiftRequests);

  await context.route(`${API}/**`, async route => {
    const req = route.request();
    const u = new URL(req.url());
    const m = req.method();
    let body = { success: true };

    if (m === "OPTIONS") {
      return route.fulfill({
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
          "access-control-allow-headers": "Content-Type, Authorization",
        },
      });
    }

    if (u.pathname === "/me") body = { ...fx.me, role };
    else if (u.pathname === "/announcements") body = fx.announcements;
    else if (u.pathname === "/dashboard-preferences") body = fx.dashboardPreferences;
    else if (u.pathname === "/sold-warranties" && m === "GET") body = fx.soldWarranties;
    else if (u.pathname === "/warranty-stats") body = fx.warrantyStats;
    else if (u.pathname === "/notes" && m === "GET") body = fx.notes;
    else if (u.pathname === "/profile") body = fx.profile;
    else if (u.pathname === "/shift-requests" && m === "GET") {
      const status = u.searchParams.get("status") || "pending";
      const week = u.searchParams.get("week");
      let list = shiftRequests.filter(r => status === "all" || r.status === status);
      if (week) {
        const [a, b] = weekRange(week);
        list = list.filter(r => r.request_date >= a && r.request_date <= b);
      }
      body = { requests: list.sort((x, y) => (x.request_date < y.request_date ? -1 : 1)) };
    } else if (/^\/shift-requests\/\d+\/status$/.test(u.pathname) && m === "PATCH") {
      const id = Number(u.pathname.split("/")[2]);
      const payload = JSON.parse(req.postData() || "{}");
      const r = shiftRequests.find(x => x.id === id);
      if (r) {
        r.status = payload.status;
        r.admin_note = payload.admin_note || null;
      }
      body = { success: true };
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify(body),
    });
  });
}
