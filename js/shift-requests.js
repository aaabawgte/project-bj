const currentUser = JSON.parse(localStorage.getItem("user") || "null");
const token = localStorage.getItem("token");
const requestsContainer = document.querySelector("#requests-container");
const pageTitle = document.querySelector("#page-title");
const weekFilter = document.querySelector("#week-filter");
const weekRange = document.querySelector("#week-range");
const previousWeekButton = document.querySelector("#previous-week");
const nextWeekButton = document.querySelector("#next-week");

if (!currentUser || !token) {
    window.location.href = "../index.html";
}

if (!["admin", "superadmin"].includes(currentUser.role)) {
    window.location.href = "dashboard.html";
}

const params = new URLSearchParams(window.location.search);
const status = params.get("status") || "pending";

setPageTitle();
setDefaultWeek();
setupWeekControls();
loadRequests();

async function loadRequests() {
    const selectedWeek = weekFilter?.value || "";
    const weekQuery = selectedWeek ? `&week=${selectedWeek}` : "";
    try {
        const response = await fetch(`${API_URL}/shift-requests?status=${status}${weekQuery}`, {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Greška prilikom učitavanja zahtjeva.");
        }

        renderRequests(data.requests || []);

    } catch (error) {
        requestsContainer.innerHTML = `
            <div class="card">
                <p class="text-muted">${error.message}</p>
            </div>
        `;
    }
}

function renderRequests(requests) {
    if (!requests.length) {
        requestsContainer.innerHTML = `
            <div class="card">
                <p class="text-muted">Nema zahtjeva za prikaz.</p>
            </div>
        `;
        return;
    }

    requestsContainer.innerHTML = requests.map(request => `
        <article class="card shift-request-card">
            <div class="shift-request-header">
                <div>
                    <h2>${request.username || "Nepoznato"}</h2>
                    <p class="text-muted">
                        ${formatCroatianDate(request.request_date)} (${request.weekday || "-"})
                    </p>
                </div>

                <span class="status-badge status-${request.status}">
                    ${getStatusLabel(request.status)}
                </span>
            </div>

            <div class="shift-request-details">
                <p><strong>Smjena:</strong> ${getShiftLabel(request.shift_type)}</p>
                <p><strong>Razlog:</strong> ${request.reason || "-"}</p>
                <p><strong>Napomena:</strong> ${request.admin_note || "-"}</p>
            </div>

            ${request.status === "pending" ? `
                <div class="page-actions">
                    <button class="btn btn-primary approve-btn" data-id="${request.id}">
                        ✅ Odobri
                    </button>

                    <button class="btn btn-danger reject-btn" data-id="${request.id}">
                        ❌ Odbij
                    </button>
                </div>
            ` : ""}
        </article>
    `).join("");

    document.querySelectorAll(".approve-btn").forEach(button => {
        button.addEventListener("click", () => {
            processRequest(button.dataset.id, "approved");
        });
    });

    document.querySelectorAll(".reject-btn").forEach(button => {
        button.addEventListener("click", () => {
            processRequest(button.dataset.id, "rejected");
        });
    });
}

async function processRequest(requestId, newStatus) {
    const adminNote = prompt("Napomena voditelja (opcionalno):") || "";

    try {
        const response = await fetch(`${API_URL}/shift-requests/${requestId}/status`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                status: newStatus,
                admin_note: adminNote
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Greška prilikom obrade zahtjeva.");
        }

        alert("Zahtjev je uspješno obrađen.");
        loadRequests();

    } catch (error) {
        alert(error.message);
    }
}

function setupWeekControls() {
    if (!weekFilter) return;

    weekFilter.addEventListener("change", () => {
        updateWeekRange();
        loadRequests();
    });

    previousWeekButton?.addEventListener("click", () => moveWeek(-1));
    nextWeekButton?.addEventListener("click", () => moveWeek(1));
}

function setDefaultWeek() {
    if (!weekFilter) return;

    const today = new Date();
    weekFilter.value = getISOWeekValue(today);
    updateWeekRange();
}

function moveWeek(direction) {
    if (!weekFilter.value) {
        setDefaultWeek();
        return;
    }

    const monday = getMondayFromWeekValue(weekFilter.value);
    monday.setDate(monday.getDate() + (direction * 7));

    weekFilter.value = getISOWeekValue(monday);
    updateWeekRange();
    loadRequests();
}

function updateWeekRange() {
    if (!weekFilter || !weekRange || !weekFilter.value) return;

    const monday = getMondayFromWeekValue(weekFilter.value);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    weekRange.textContent = `${formatCroatianDateObject(monday)} - ${formatCroatianDateObject(sunday)}`;
}

function getISOWeekValue(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);

    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);

    return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function getMondayFromWeekValue(weekValue) {
    const [yearText, weekText] = weekValue.split("-W");
    const year = Number(yearText);
    const week = Number(weekText);

    const date = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
    const day = date.getUTCDay() || 7;

    if (day <= 4) {
        date.setUTCDate(date.getUTCDate() - day + 1);
    } else {
        date.setUTCDate(date.getUTCDate() + 8 - day);
    }

    return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function formatCroatianDateObject(date) {
    return new Intl.DateTimeFormat("hr-HR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    }).format(date);
}

function setPageTitle() {
    const titles = {
        pending: "🕓 Novi zahtjevi",
        approved: "✅ Odobreni zahtjevi",
        rejected: "❌ Odbijeni zahtjevi",
        all: "📦 Svi zahtjevi"
    };

    pageTitle.textContent = titles[status] || "📋 Zahtjevi";
}

function getStatusLabel(status) {
    if (status === "approved") return "Odobreno";
    if (status === "rejected") return "Odbijeno";
    return "Na čekanju";
}

function getShiftLabel(shiftType) {
    if (shiftType === "jutro") return "Ujutro";
    if (shiftType === "popodne") return "Popodne";
    if (shiftType === "slobodno") return "Slobodno";
    return shiftType || "-";
}

function formatCroatianDate(value) {
    if (!value) return "-";

    return new Intl.DateTimeFormat("hr-HR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    }).format(new Date(`${value}T00:00:00`));
}
