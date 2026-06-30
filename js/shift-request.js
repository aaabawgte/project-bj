const currentUser = JSON.parse(localStorage.getItem("user") || "null");

if (!currentUser) {
    window.location.href = "../index.html";
}

const form = document.querySelector("#shift-request-form");
const dateInput = document.querySelector("#request-date");
const weekdayPreview = document.querySelector("#weekday-preview");
const shiftTypeInput = document.querySelector("#shift-type");
const reasonInput = document.querySelector("#reason");

const weekdays = [
    "nedjelja",
    "ponedjeljak",
    "utorak",
    "srijeda",
    "četvrtak",
    "petak",
    "subota"
];

const firstAllowedDate = getNextScheduleWeekStart();
dateInput.min = formatDateForInput(firstAllowedDate);

weekdayPreview.textContent = `Prvi dozvoljeni datum: ${formatCroatianDate(firstAllowedDate)} (${getWeekdayName(firstAllowedDate)})`;

dateInput.addEventListener("change", () => {
    if (!dateInput.value) {
        weekdayPreview.textContent = `Prvi dozvoljeni datum: ${formatCroatianDate(firstAllowedDate)} (${getWeekdayName(firstAllowedDate)})`;
        return;
    }

    const selectedDate = new Date(`${dateInput.value}T00:00:00`);
    weekdayPreview.textContent = `${formatCroatianDate(selectedDate)} (${getWeekdayName(selectedDate)})`;
});

form.addEventListener("submit", (event) => {
    event.preventDefault();

    if (!dateInput.value || !shiftTypeInput.value) {
        alert("Odaberi datum i smjenu.");
        return;
    }

    const selectedDate = new Date(`${dateInput.value}T00:00:00`);

    if (selectedDate < firstAllowedDate) {
        alert("Zahtjev je moguće poslati tek za sljedeći rasporedni tjedan.");
        return;
    }

    const requestData = {
        request_date: dateInput.value,
        weekday: getWeekdayName(selectedDate),
        shift_type: shiftTypeInput.value,
        reason: reasonInput.value.trim()
    };

    submitRequest(requestData);
});

async function submitRequest(requestData) {
    const token = localStorage.getItem("token");

    try {
        const response = await fetch(`${API_URL}/shift-requests`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(requestData)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Greška prilikom slanja zahtjeva.");
        }

        alert("Zahtjev je uspješno poslan.");

        form.reset();
        weekdayPreview.textContent = `Prvi dozvoljeni datum: ${formatCroatianDate(firstAllowedDate)} (${getWeekdayName(firstAllowedDate)})`;

    } catch (error) {
        alert(error.message);
    }
}

function getNextScheduleWeekStart() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const day = today.getDay();
    const daysUntilNextMonday = day === 0 ? 1 : 8 - day;

    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + daysUntilNextMonday);

    return nextMonday;
}

function getWeekdayName(date) {
    return weekdays[date.getDay()];
}

function formatDateForInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function formatCroatianDate(date) {
    return new Intl.DateTimeFormat("hr-HR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    }).format(date);
}