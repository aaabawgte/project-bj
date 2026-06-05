const API_URL = "https://project-bj-api.aaabawgte.workers.dev";

const warrantyData = {
  A: [
    ["Produženo održavanje 3+2 god", 9],
    ["Produženo održavanje 2+3 god", 9],
    ["Produženo održavanje 5+2 god", 13],
    ["Produženo održavanje 2+3 god + zaštita od oštećenja 5 god", 18],
    ["Produženo održavanje 3+2 god + zaštita od oštećenja 5 god", 18],
    ["Produženo održavanje 5+2 god + zaštita od oštećenja 7 god", 26]
  ],
  B: [
    ["Produženo održavanje 3+2 god", 9],
    ["Produženo održavanje 2+3 god", 9],
    ["Produženo održavanje 5+2 god", 13],
    ["Produženo održavanje 2+3 god + zaštita od oštećenja 5 god", 18],
    ["Produženo održavanje 3+2 god + zaštita od oštećenja 5 god", 18],
    ["Produženo održavanje 5+2 god + zaštita od oštećenja 7 god", 26]
  ],
  mobile: [
    ["Zaštita od oštećenja i loma 1 god", 12],
    ["Zaštita od oštećenja i loma 2 god", 24],
    ["Produženo održavanje 2+1 god", 8]
  ],
  bike: [
    ["Produženo održavanje 2+1 god", 14],
    ["Produženo održavanje 2+1 god + zaštita od oštećenja 3 god", 27]
  ]
};

const groupNames = {
  A: "Grupa A",
  B: "Grupa B",
  mobile: "Mobilni uređaji",
  bike: "Bicikli i romobili",
  none: "Bez jamstva"
};

const token = localStorage.getItem("token");
const form = document.querySelector("#product-form");
const priceInput = document.querySelector("#price");
const groupSelect = document.querySelector("#group");
const warrantySelect = document.querySelector("#warranty");
const warrantyWrapper = document.querySelector("#warranty-wrapper");
const productsTable = document.querySelector("#products-table");
const subtotalEl = document.querySelector("#subtotal");
const warrantyTotalEl = document.querySelector("#warranty-total");
const grandTotalEl = document.querySelector("#grand-total");
const installmentsInput = document.querySelector("#installments");
const installmentsValueEl = document.querySelector("#installments-value");
const monthlySubtotalEl = document.querySelector("#monthly-subtotal");
const monthlyWarrantyEl = document.querySelector("#monthly-warranty");
const monthlyTotalEl = document.querySelector("#monthly-total");

const customerViewButton = document.querySelector("#customer-view-btn");
const customerView = document.querySelector("#customer-view");
const closeCustomerViewButton = document.querySelector("#close-customer-view");
const customerInstallmentsEl = document.querySelector("#customer-installments");
const customerTotalEl = document.querySelector("#customer-total");
const customerMonthlySubtotalEl = document.querySelector("#customer-monthly-subtotal");
const customerMonthlyTotalEl = document.querySelector("#customer-monthly-total");
const customerMonthlyDifferenceEl = document.querySelector("#customer-monthly-difference");

let products = [];

if (!token) {
  window.location.href = "../index.html";
} else {
  checkSession();
  updateWarrantyOptions();
  renderTotals();
}

form?.addEventListener("submit", addProduct);
groupSelect?.addEventListener("change", updateWarrantyOptions);
installmentsInput?.addEventListener("input", renderTotals);
customerViewButton?.addEventListener("click", openCustomerView);
closeCustomerViewButton?.addEventListener("click", closeCustomerView);

priceInput?.addEventListener("blur", () => {
  const price = parsePrice(priceInput.value);

  if (price > 0) {
    priceInput.value = formatNumber(price);
  }
});

productsTable?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-id]");

  if (!button) return;

  products = products.filter(product => product.id !== button.dataset.id);
  renderProducts();
});

async function checkSession() {
  try {
    const response = await fetch(`${API_URL}/me`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error("Invalid session");
    }
  } catch (error) {
    console.error(error);
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    window.location.href = "../index.html";
  }
}

function updateWarrantyOptions() {
  const group = groupSelect.value;
  const warranties = warrantyData[group] || [];

  warrantySelect.innerHTML = "";

  if (group === "none") {
    warrantyWrapper.hidden = true;
    return;
  }

  warrantyWrapper.hidden = false;
  warrantySelect.append(new Option("Odaberi jamstvo", ""));

  warranties.forEach(([name, percent], index) => {
    warrantySelect.append(new Option(`${name} (${percent}%)`, String(index)));
  });
}

function addProduct(event) {
  event.preventDefault();

  const price = parsePrice(priceInput.value);
  const group = groupSelect.value;
  const warrantyIndex = warrantySelect.value;

  if (!price || price <= 0) {
    alert("Unesi ispravnu cijenu proizvoda.");
    return;
  }

  if (!group) {
    alert("Odaberi grupu proizvoda.");
    return;
  }

  if (group !== "none" && warrantyIndex === "") {
    alert("Odaberi tip jamstva.");
    return;
  }

  const warranty = getWarranty(group, warrantyIndex);
  const warrantyAmount = price * (warranty.percent / 100);

  products.push({
    id: crypto.randomUUID(),
    price,
    group,
    warrantyName: warranty.name,
    warrantyAmount
  });

  form.reset();
  updateWarrantyOptions();
  renderProducts();
  priceInput.focus();
}

function getWarranty(group, warrantyIndex) {
  if (group === "none") {
    return {
      name: "Bez jamstva",
      percent: 0
    };
  }

  const warranty = warrantyData[group][Number(warrantyIndex)];

  return {
    name: warranty[0],
    percent: warranty[1]
  };
}

function renderProducts() {
  productsTable.innerHTML = "";

  products.forEach(product => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${formatEuro(product.price)}</td>
      <td>${groupNames[product.group]}</td>
      <td>${product.warrantyName}</td>
      <td>${formatEuro(product.warrantyAmount)}</td>
      <td><button class="btn btn-secondary" data-id="${product.id}">Ukloni</button></td>
    `;

    productsTable.append(row);
  });

  renderTotals();
}

function renderTotals() {
  const totals = getTotals();

  subtotalEl.textContent = formatEuro(totals.subtotal);
  warrantyTotalEl.textContent = formatEuro(totals.warrantyTotal);
  grandTotalEl.textContent = formatEuro(totals.total);

  installmentsValueEl.textContent = totals.installments;
  monthlySubtotalEl.textContent = formatEuro(totals.monthlySubtotal);
  monthlyWarrantyEl.textContent = formatEuro(totals.monthlyDifference);
  monthlyTotalEl.textContent = formatEuro(totals.monthlyTotal);
}

function openCustomerView() {
  if (!products.length) {
    alert("Prvo dodaj barem jedan proizvod.");
    return;
  }

  const totals = getTotals();

  customerInstallmentsEl.textContent = `${totals.installments} rata`;
  customerTotalEl.textContent = formatEuro(totals.total);
  customerMonthlySubtotalEl.textContent = formatEuro(totals.monthlySubtotal);
  customerMonthlyTotalEl.textContent = formatEuro(totals.monthlyTotal);
  customerMonthlyDifferenceEl.textContent = formatEuro(totals.monthlyDifference);

  customerView.hidden = false;
}

function closeCustomerView() {
  customerView.hidden = true;
}

function getTotals() {
  const subtotal = products.reduce((sum, product) => sum + product.price, 0);
  const warrantyTotal = products.reduce((sum, product) => sum + product.warrantyAmount, 0);
  const total = subtotal + warrantyTotal;
  const installments = Number(installmentsInput?.value || 12);

  return {
    subtotal,
    warrantyTotal,
    total,
    installments,
    monthlySubtotal: subtotal / installments,
    monthlyTotal: total / installments,
    monthlyDifference: warrantyTotal / installments
  };
}

function parsePrice(value) {
  let cleanValue = String(value)
    .trim()
    .replace(/\s/g, "")
    .replace(/€/g, "");

  if (cleanValue.includes(",")) {
    cleanValue = cleanValue.replace(/\./g, "").replace(",", ".");
  }

  return Number(cleanValue);
}

function formatNumber(value) {
  return new Intl.NumberFormat("hr-HR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

function formatEuro(value) {
  return new Intl.NumberFormat("hr-HR", {
    style: "currency",
    currency: "EUR"
  }).format(value);
}
