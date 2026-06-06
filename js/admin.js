

const API_URL = "https://project-bj-api.aaabawgte.workers.dev";

const token = localStorage.getItem("token");
const pendingUsersEl = document.querySelector("#pending-users");
const activeUsersEl = document.querySelector("#active-users");

let users = [];

if (!token) {
  window.location.href = "../index.html";
} else {
  loadUsers();
}

pendingUsersEl?.addEventListener("click", handleUserAction);
activeUsersEl?.addEventListener("click", handleUserAction);

async function loadUsers() {
  try {
    const response = await fetch(`${API_URL}/admin/users`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (response.status === 403) {
      window.location.href = "dashboard.html";
      return;
    }

    if (!response.ok) {
      throw new Error("Failed to load users");
    }

    users = await response.json();
    renderUsers();
  } catch (error) {
    console.error(error);
    alert("Greška kod učitavanja korisnika.");
  }
}

function renderUsers() {
  const pendingUsers = users.filter(user => user.status === "pending");
  const activeUsers = users.filter(user => user.status === "active");

  renderUserList(pendingUsersEl, pendingUsers, true);
  renderUserList(activeUsersEl, activeUsers, false);
}

function renderUserList(container, items, isPendingList) {
  container.innerHTML = "";

  if (!items.length) {
    container.innerHTML = `<p class="text-muted">Nema korisnika za prikaz.</p>`;
    return;
  }

  const list = document.createElement("div");
  list.className = "stats-list";

  items.forEach(user => {
    const row = document.createElement("div");
    row.className = "admin-user-row";

    row.innerHTML = `
      <div>
        <strong>${escapeHtml(user.username)}</strong>
        <span>${escapeHtml(user.role)} · ${escapeHtml(user.status)}</span>
      </div>

      <div class="admin-user-actions">
        ${isPendingList ? `
          <button class="btn btn-secondary" type="button" data-action="approve" data-id="${user.id}">
            Odobri
          </button>
        ` : `
          <button class="btn btn-secondary" type="button" data-action="toggle-role" data-id="${user.id}">
            ${user.role === "admin" ? "Makni admin" : "Postavi admin"}
          </button>
        `}

        <button class="btn btn-secondary" type="button" data-action="reset-password" data-id="${user.id}">
          Nova lozinka
        </button>

        <button class="btn btn-secondary" type="button" data-action="delete" data-id="${user.id}">
          Obriši
        </button>
      </div>
    `;

    list.appendChild(row);
  });

  container.appendChild(list);
}

async function handleUserAction(event) {
  const button = event.target.closest("button[data-action][data-id]");

  if (!button) {
    return;
  }

  const user = users.find(item => String(item.id) === button.dataset.id);

  if (!user) {
    return;
  }

  if (button.dataset.action === "approve") {
    await updateUser(user, {
      status: "active"
    });
  }

  if (button.dataset.action === "toggle-role") {
    await updateUser(user, {
      role: user.role === "admin" ? "user" : "admin"
    });
  }

  if (button.dataset.action === "reset-password") {
    const password = prompt(`Nova lozinka za ${user.username}:`);

    if (!password) {
      return;
    }

    await updateUser(user, {
      password
    });
  }

  if (button.dataset.action === "delete") {
    await deleteUser(user);
  }
}

async function updateUser(user, changes) {
  try {
    const response = await fetch(`${API_URL}/admin/users/${user.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        username: changes.username || user.username,
        role: changes.role || user.role,
        status: changes.status || user.status,
        password: changes.password || ""
      })
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to update user");
    }

    await loadUsers();
  } catch (error) {
    console.error(error);
    alert(error.message || "Greška kod spremanja korisnika.");
  }
}

async function deleteUser(user) {
  const confirmed = confirm(`Obrisati korisnika ${user.username}? Ovo briše i njegove bilješke i prodana jamstva.`);

  if (!confirmed) {
    return;
  }

  try {
    const response = await fetch(`${API_URL}/admin/users/${user.id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to delete user");
    }

    await loadUsers();
  } catch (error) {
    console.error(error);
    alert(error.message || "Greška kod brisanja korisnika.");
  }
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}