

const API_URL = "https://project-bj-api.aaabawgte.workers.dev";

const token = localStorage.getItem("token");

if (!token) {
  window.location.href = "../index.html";
}

const totalSoldEl = document.querySelector("#total-sold");
const totalRevenueEl = document.querySelector("#total-revenue");
const averagePriceEl = document.querySelector("#average-price");
const todaySoldEl = document.querySelector("#today-sold");
const topWarrantyEl = document.querySelector("#top-warranty");
const highestWarrantyEl = document.querySelector("#highest-warranty");

const byTypeList = document.querySelector("#by-type-list");
const byUserList = document.querySelector("#by-user-list");
const byDayList = document.querySelector("#by-day-list");
const warrantyTypeChart = document.querySelector("#warranty-type-chart");

loadStats();

async function loadStats() {
  try {
    const response = await fetch(`${API_URL}/warranty-stats`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error("Failed to load stats");
    }

    const stats = await response.json();

    renderSummary(stats);
    renderByType(stats.byType || []);
    renderByUser(stats.byUser || []);
    renderByDay(stats.byDay || []);
  } catch (error) {
    console.error(error);
    alert("Greška kod učitavanja statistike.");
  }
}

function renderSummary(stats) {
  totalSoldEl.textContent = stats.totalSold || 0;
  totalRevenueEl.textContent = formatEuro(stats.totalRevenue || 0);
  averagePriceEl.textContent = formatEuro(stats.averagePrice || 0);
  todaySoldEl.textContent = stats.todaySold || 0;
  topWarrantyEl.textContent = stats.topWarranty || "-";
  highestWarrantyEl.textContent = formatEuro(stats.highestWarranty || 0);
}

function renderByType(items) {
  byTypeList.innerHTML = "";
  warrantyTypeChart.innerHTML = "";

  const total = items.reduce((sum, item) => sum + Number(item.count), 0);

  if (!items.length || total === 0) {
    warrantyTypeChart.innerHTML = `<p class="text-muted">Nema podataka za prikaz.</p>`;
    return;
  }

  let currentPercent = 0;

  const chartParts = items.map((item, index) => {
    const percent = (Number(item.count) / total) * 100;
    const start = currentPercent;
    const end = currentPercent + percent;

    currentPercent = end;

    return `var(--chart-${(index % 8) + 1}) ${start}% ${end}%`;
  });

  warrantyTypeChart.innerHTML = `
    <div class="pie-chart-wrap">
      <div class="pie-chart" style="background: conic-gradient(${chartParts.join(", ")})">
        <div class="pie-chart-label">
          <div>
            ${total}
            <span>ukupno</span>
          </div>
        </div>
      </div>
    </div>
  `;

  const list = document.createElement("div");
  list.className = "stats-list";

  items.forEach((item, index) => {
    const row = document.createElement("div");
    const percent = total > 0 ? Math.round((Number(item.count) / total) * 100) : 0;

    row.className = "stats-row stats-row-with-color";

    row.innerHTML = `
      <strong>
        <i class="chart-dot" style="--dot-color: var(--chart-${(index % 8) + 1})"></i>
        ${escapeHtml(item.warranty_type)}
      </strong>
      <span>${item.count} kom · ${percent}%</span>
      <span>${formatEuro(item.revenue)}</span>
    `;

    list.appendChild(row);
  });

  byTypeList.appendChild(list);
}

function renderByUser(items) {
  byUserList.innerHTML = "";

  const list = document.createElement("div");
  list.className = "stats-list";

  items.forEach(item => {
    const row = document.createElement("div");
    row.className = "stats-row";

    row.innerHTML = `
      <strong>${escapeHtml(item.username)}</strong>
      <span>${item.count} kom</span>
      <span>${formatEuro(item.revenue)}</span>
    `;

    list.appendChild(row);
  });

  byUserList.appendChild(list);
}

function renderByDay(items) {
  byDayList.innerHTML = "";

  const list = document.createElement("div");
  list.className = "stats-list";

  items.forEach(item => {
    const row = document.createElement("div");
    row.className = "stats-row";

    row.innerHTML = `
      <strong>${formatDate(item.sale_date)}</strong>
      <span>${item.count} kom</span>
      <span>${formatEuro(item.revenue)}</span>
    `;

    list.appendChild(row);
  });

  byDayList.appendChild(list);
}

function formatEuro(value) {
  return new Intl.NumberFormat("hr-HR", {
    style: "currency",
    currency: "EUR"
  }).format(Number(value));
}

function formatDate(value) {
  return new Intl.DateTimeFormat("hr-HR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(value));
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}