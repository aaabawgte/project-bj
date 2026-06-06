const API_URL = "https://project-bj-api.aaabawgte.workers.dev";

const token = localStorage.getItem("token");
const logoutButton = document.querySelector("#logout-btn");
const adminTile = document.querySelector("#admin-tile");
const currentUser = document.querySelector("#current-user");
const announcementsList = document.querySelector("#announcements-list");
const announcementForm = document.querySelector("#announcement-form");
const announcementContent = document.querySelector("#announcement-content");

let isAdmin = false;

if (!token) {
  window.location.href = "../index.html";
}

initDashboard();

async function initDashboard() {
  await checkSession();
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

  if (adminTile && !isAdmin) adminTile.style.display = "none";
  if (announcementForm && isAdmin) announcementForm.hidden = false;
  if (currentUser) currentUser.textContent = `👤 ${data.username}`;
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