const API_URL = "https://project-bj-api.aaabawgte.workers.dev";

const token = localStorage.getItem("token");
const logoutButton = document.querySelector("#logout-btn");
const adminTile = document.querySelector("#admin-tile");
const dealCalculatorTile = document.querySelector("#deal-calculator-tile");
const dealToolCard = document.querySelector("#deal-tool-card");
const currentUser = document.querySelector("#current-user");
const announcementsList = document.querySelector("#announcements-list");
const announcementForm = document.querySelector("#announcement-form");
const announcementContent = document.querySelector("#announcement-content");

const customizeDashboardButton = document.querySelector("#customize-dashboard-btn");
const dashboardCustomizeModal = document.querySelector("#dashboard-customize-modal");
const closeDashboardCustomizeButton = document.querySelector("#close-dashboard-customize");
const saveDashboardLayoutButton = document.querySelector("#save-dashboard-layout");
const dashboardToolsEditor = document.querySelector("#dashboard-tools-editor");

const dashboardGrid = document.querySelector(".dashboard-grid");

const DEFAULT_DASHBOARD_TOOLS = [
  { id: "calculator", name: "💰 Kalkulator", visible: true },
  { id: "notes", name: "📝 Bilješke", visible: true },
  { id: "warranties", name: "🛡️ Jamstva", visible: true },
  { id: "warranty-stats", name: "📊 Statistika jamstava", visible: true },
  { id: "action-search", name: "🏷️ Pretraga akcija", visible: true },
  { id: "shifts", name: "📅 Smjene", visible: true }
];

let dashboardLayout = [...DEFAULT_DASHBOARD_TOOLS];

let isAdmin = false;

if (!token) {
  window.location.href = "../index.html";
}

initDashboard();

customizeDashboardButton?.addEventListener("click", openDashboardCustomizeModal);
closeDashboardCustomizeButton?.addEventListener("click", closeDashboardCustomizeModal);

saveDashboardLayoutButton?.addEventListener("click", async () => {
  try {
    const response = await fetch(`${API_URL}/dashboard-preferences`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ layout: dashboardLayout })
    });

    if (!response.ok) throw new Error();

    applyDashboardLayout(dashboardLayout);
    alert("Dashboard spremljen.");
    closeDashboardCustomizeModal();
  } catch {
    alert("Greška kod spremanja dashboarda.");
  }
});

dashboardToolsEditor?.addEventListener("change", (event) => {
  const input = event.target.closest("input[data-tool]");
  if (!input) return;

  dashboardLayout = dashboardLayout.map(tool => {
    if (tool.id !== input.dataset.tool) return tool;
    return { ...tool, visible: input.checked };
  });
});

dashboardToolsEditor?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-move]");
  if (!button) return;

  const index = Number(button.dataset.index);
  const direction = Number(button.dataset.move);
  const newIndex = index + direction;

  if (newIndex < 0 || newIndex >= dashboardLayout.length) return;

  const updatedLayout = [...dashboardLayout];
  const [movedTool] = updatedLayout.splice(index, 1);
  updatedLayout.splice(newIndex, 0, movedTool);

  dashboardLayout = updatedLayout;
  renderDashboardToolsEditor();
});

async function initDashboard() {
  await checkSession();
  await loadDashboardPreferences();
  await loadAnnouncements();
}

logoutButton?.addEventListener("click", async () => {
  try {
    await fetch(`${API_URL}/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }
    });
  } catch (error) {
    console.error(error);
  }

  localStorage.removeItem("token");
  localStorage.removeItem("username");
  window.location.href = "../index.html";
});

announcementForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const content = announcementContent.value.trim();
  if (!content) return;

  try {
    const response = await fetch(`${API_URL}/announcements`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ content })
    });

    if (!response.ok) throw new Error();

    announcementContent.value = "";
    await loadAnnouncements();
  } catch {
    alert("Greška kod objave obavijesti.");
  }
});

announcementsList?.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-announcement-id]");
  if (!button) return;

  await fetch(`${API_URL}/announcements/${button.dataset.announcementId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` }
  });

  await loadAnnouncements();
});

async function checkSession() {
  const response = await fetch(`${API_URL}/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    window.location.href = "../index.html";
    return;
  }

  const data = await response.json();
  isAdmin = data.role === "admin";

  if (adminTile && !isAdmin) {
    adminTile.style.display = "none";
  }

  if (dealCalculatorTile) {
    dealCalculatorTile.hidden = !isAdmin;
  }

  if (dealToolCard) {
    dealToolCard.hidden = !isAdmin;
  }

  if (announcementForm && isAdmin) {
    announcementForm.hidden = false;
  }

  if (currentUser) {
    currentUser.textContent = `👤 ${data.username}`;
  }
}

async function loadAnnouncements() {
  const response = await fetch(`${API_URL}/announcements`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    announcementsList.innerHTML = '<p class="text-muted">Greška kod učitavanja.</p>';
    return;
  }

  const announcements = await response.json();

  if (!announcements.length) {
    announcementsList.innerHTML = '<p class="text-muted">Nema obavijesti.</p>';
    return;
  }

  announcementsList.innerHTML = announcements.map(item => {
    const username = escapeHtml(item.username);
    const content = escapeHtml(String(item.content || "").trim());
    const date = new Date(item.created_at).toLocaleDateString("hr-HR");
    const deleteButton = isAdmin
      ? `<button class="btn announcement-delete" data-announcement-id="${item.id}">Obriši</button>`
      : "";

    return `<div class="announcement-item"><div class="announcement-meta"><span>${username}</span><span>${date}</span></div><div class="announcement-content">${content}</div>${deleteButton}</div>`;
  }).join("");
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

async function loadDashboardPreferences() {
  try {
    const response = await fetch(`${API_URL}/dashboard-preferences`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) throw new Error();

    const data = await response.json();
    dashboardLayout = mergeDashboardLayout(data.layout);
    applyDashboardLayout(dashboardLayout);
  } catch {
    dashboardLayout = [...DEFAULT_DASHBOARD_TOOLS];
    applyDashboardLayout(dashboardLayout);
  }
}

function mergeDashboardLayout(savedLayout) {
  if (!Array.isArray(savedLayout)) {
    return [...DEFAULT_DASHBOARD_TOOLS];
  }

  const defaultMap = new Map(DEFAULT_DASHBOARD_TOOLS.map(tool => [tool.id, tool]));
  const merged = [];

  savedLayout.forEach(savedTool => {
    const defaultTool = defaultMap.get(savedTool.id);
    if (!defaultTool) return;

    merged.push({
      ...defaultTool,
      visible: savedTool.visible !== false
    });
  });

  DEFAULT_DASHBOARD_TOOLS.forEach(defaultTool => {
    const alreadyExists = merged.some(tool => tool.id === defaultTool.id);
    if (!alreadyExists) merged.push(defaultTool);
  });

  return merged;
}

function applyDashboardLayout(layout) {
  if (!dashboardGrid) return;

  layout.forEach(tool => {
    const tile = dashboardGrid.querySelector(`[data-tool="${tool.id}"]`);
    if (!tile) return;

    tile.hidden = tool.visible === false;
    dashboardGrid.appendChild(tile);
  });
}

function renderDashboardToolsEditor() {
  if (!dashboardToolsEditor) return;

  dashboardToolsEditor.innerHTML = dashboardLayout.map((tool, index) => `
    <div class="dashboard-tool-editor-item" style="display:grid;grid-template-columns:auto 1fr auto auto;align-items:center;gap:10px;padding:14px;border:1px solid var(--border);border-radius:14px;margin-top:12px;">
      <input type="checkbox" ${tool.visible ? "checked" : ""} data-tool="${tool.id}">
      <span>${tool.name}</span>
      <button type="button" class="btn btn-secondary" data-index="${index}" data-move="-1" ${index === 0 ? "disabled" : ""}>↑</button>
      <button type="button" class="btn btn-secondary" data-index="${index}" data-move="1" ${index === dashboardLayout.length - 1 ? "disabled" : ""}>↓</button>
    </div>
  `).join("");
}

function openDashboardCustomizeModal() {
  if (!dashboardCustomizeModal) return;

  dashboardCustomizeModal.hidden = false;
  renderDashboardToolsEditor();
}

function closeDashboardCustomizeModal() {
  if (!dashboardCustomizeModal) return;
  dashboardCustomizeModal.hidden = true;
}