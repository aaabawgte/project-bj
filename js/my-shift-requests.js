const currentUser = JSON.parse(localStorage.getItem("user") || "null");
const token = localStorage.getItem("token");
const requestsContainer = document.querySelector("#requests-container");

if (!currentUser || !token) {
    window.location.href = "../index.html";
}

loadMyRequests();

async function loadMyRequests() {
    try {
        const response = await fetch(`${API_URL}/my-shift-requests`, {
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
                <p class="text-muted">Još nemaš poslanih zahtjeva.</p>
            </div>
        `;
        return;
    }

    requestsContainer.innerHTML = requests.map((request) => {
        return `
            <article class="card shift-request-card">
                <div class="shift-request-header">
                    <div>
                        <h2>${formatCroatianDate(request.request_date)}</h2>
                        <p class="text-muted">${request.weekday || "-"}</p>
                    </div>

                    <span class="status-badge status-${request.status}">
                        ${getStatusLabel(request.status)}
                    </span>
                </div>

                <div class="shift-request-details">
                    <p><strong>Smjena:</strong> ${getShiftLabel(request.shift_type)}</p>
                    <p><strong>Razlog:</strong> ${request.reason || "-"}</p>
                    <p><strong>Napomena voditelja:</strong> ${request.admin_note || "-"}</p>
                    <p><strong>Kreirano:</strong> ${formatCroatianDateTime(request.created_at)}</p>
                </div>

                ${request.status === "pending" ? `
                    <div class="page-actions">
                        <button class="btn btn-danger withdraw-btn" data-id="${request.id}">
                            🗑 Povuci zahtjev
                        </button>
                    </div>
                ` : ""}
            </article>
        `;
    }).join("");

    document.querySelectorAll(".withdraw-btn").forEach(button => {
        button.addEventListener("click", () => {
            withdrawRequest(button.dataset.id);
        });
    });
}

async function withdrawRequest(requestId) {
    const confirmed = confirm("Jesi siguran da želiš povući zahtjev?");

    if (!confirmed) return;

    try {
        const response = await fetch(`${API_URL}/shift-requests/${requestId}`, {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Greška prilikom povlačenja zahtjeva.");
        }

        alert("Zahtjev je uspješno povučen.");
        loadMyRequests();

    } catch (error) {
        alert(error.message);
    }
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

function formatCroatianDateTime(value) {
    if (!value) return "-";

    return new Intl.DateTimeFormat("hr-HR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    }).format(new Date(value));
}