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
const discountInput = document.querySelector("#discount");
const discountTypeSelect = document.querySelector("#discount-type");
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
const customerCopySection = document.querySelector("#customer-copy-section");
const customerCopyText = document.querySelector("#customer-copy-text");
const copyCustomerTextButton = document.querySelector("#copy-customer-text");

const customerViewButton = document.querySelector("#customer-view-btn");
const customerView = document.querySelector("#customer-view");
const closeCustomerViewButton = document.querySelector("#close-customer-view");
const customerInstallmentsEl = document.querySelector("#customer-installments");
const customerTotalEl = document.querySelector("#customer-total");
const customerMonthlySubtotalEl = document.querySelector("#customer-monthly-subtotal");
const customerMonthlyTotalEl = document.querySelector("#customer-monthly-total");
const customerMonthlyDifferenceEl = document.querySelector("#customer-monthly-difference");
const customerInstallmentsSlider = document.querySelector("#customer-installments-slider");
const customerInstallmentsValue = document.querySelector("#customer-installments-value");

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
discountTypeSelect?.addEventListener("change", updateDiscountInputMode);
installmentsInput?.addEventListener("input", renderTotals);
customerViewButton?.addEventListener("click", openCustomerView);
closeCustomerViewButton?.addEventListener("click", closeCustomerView);
customerInstallmentsSlider?.addEventListener("input", updateCustomerViewTotals);
copyCustomerTextButton?.addEventListener("click", copyCustomerText);

priceInput?.addEventListener("blur", () => {
  const price = parsePrice(priceInput.value);

  if (Number.isFinite(price) && price > 0) {
    priceInput.value = formatNumber(price);
  }
});

discountInput?.addEventListener("blur", () => {
  if (!discountInput.value.trim()) return;

  const discount = parsePrice(discountInput.value);

  if (Number.isFinite(discount) && discount >= 0) {
    discountInput.value = discountTypeSelect.value === "percent"
      ? formatPercent(discount)
      : formatNumber(discount);
  }
});

updateDiscountInputMode();

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

function updateDiscountInputMode() {
  if (!discountInput || !discountTypeSelect) return;

  discountInput.placeholder = discountTypeSelect.value === "percent"
    ? "npr. 10"
    : "npr. 30,00";
}

function addProduct(event) {
  event.preventDefault();

  const originalPrice = parsePrice(priceInput.value);
  const discountValue = discountInput.value.trim()
    ? parsePrice(discountInput.value)
    : 0;
  const discountType = discountTypeSelect.value;
  const group = groupSelect.value;
  const warrantyIndex = warrantySelect.value;

  if (!Number.isFinite(originalPrice) || originalPrice <= 0) {
    alert("Unesi ispravnu cijenu proizvoda.");
    return;
  }

  if (!Number.isFinite(discountValue) || discountValue < 0) {
    alert("Unesi ispravan iznos popusta.");
    return;
  }

  if (discountType === "percent" && discountValue >= 100) {
    alert("Postotak popusta mora biti manji od 100%.");
    return;
  }

  if (discountType === "amount" && discountValue >= originalPrice) {
    alert("Popust mora biti manji od cijene proizvoda.");
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
  const discount = discountType === "percent"
    ? originalPrice * (discountValue / 100)
    : discountValue;
  const price = originalPrice - discount;
  const warrantyAmount = originalPrice * (warranty.percent / 100);

  products.push({
    id: crypto.randomUUID(),
    price,
    originalPrice,
    discount,
    discountType,
    discountValue,
    group,
    warrantyName: warranty.name,
    warrantyAmount
  });

  form.reset();
  updateDiscountInputMode();
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
    const priceDetails = product.discount > 0
      ? `
        <div class="product-price-current">${formatEuro(product.price)}</div>
        <div class="product-price-meta">Redovna: ${formatEuro(product.originalPrice)}</div>
        <div class="product-price-meta">
          Popust: −${formatEuro(product.discount)}${product.discountType === "percent" ? ` (${formatPercent(product.discountValue)}%)` : ""}
        </div>
      `
      : `<div class="product-price-current">${formatEuro(product.price)}</div>`;
    const warrantyBase = product.discount > 0 && product.warrantyAmount > 0
      ? `<div class="product-price-meta">Osnovica: ${formatEuro(product.originalPrice)}</div>`
      : "";

    row.innerHTML = `
      <td>${priceDetails}</td>
      <td>${groupNames[product.group]}</td>
      <td>${product.warrantyName}</td>
      <td>
        <div class="product-price-current">${formatEuro(product.warrantyAmount)}</div>
        ${warrantyBase}
      </td>
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

  renderCustomerCopyText(totals);
}

function renderCustomerCopyText(totals) {
  if (!customerCopySection || !customerCopyText) return;

  customerCopySection.hidden = !products.length;

  if (!products.length) {
    customerCopyText.value = "";
    return;
  }

  customerCopyText.value = [
    `Plaćanje na ${formatInstallments(totals.installments)}:`,
    `Ukupna cijena: ${formatEuro(totals.total)}`,
    `Rata bez jamstva: ${formatEuro(totals.monthlySubtotal)}`,
    `Rata s jamstvom: ${formatEuro(totals.monthlyTotal)}`,
    `Razlika u rati: ${formatEuro(totals.monthlyDifference)}`
  ].join("\n");
}

async function copyCustomerText() {
  const text = customerCopyText?.value;

  if (!text) return;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      customerCopyText.focus();
      customerCopyText.select();
      document.execCommand("copy");
    }

    copyCustomerTextButton.textContent = "Kopirano!";

    window.setTimeout(() => {
      copyCustomerTextButton.textContent = "Kopiraj tekst";
    }, 1600);
  } catch (error) {
    console.error(error);
    customerCopyText.focus();
    customerCopyText.select();
    alert("Kopiranje nije uspjelo. Tekst je označen pa ga možeš kopirati ručno.");
  }
}

function openCustomerView() {
  if (!products.length) {
    alert("Prvo dodaj barem jedan proizvod.");
    return;
  }

  if (customerInstallmentsSlider) {
    customerInstallmentsSlider.value = installmentsInput.value;
  }

  updateCustomerViewTotals();
  customerView.hidden = false;
}

function updateCustomerViewTotals() {
  const totals = getTotals();

  const installments = Number(
    customerInstallmentsSlider?.value || totals.installments
  );

  customerInstallmentsEl.textContent = formatInstallments(installments);

  if (customerInstallmentsValue) {
    customerInstallmentsValue.textContent = installments;
  }

  customerTotalEl.textContent = formatEuro(totals.total);
  customerMonthlySubtotalEl.textContent = formatEuro(totals.subtotal / installments);
  customerMonthlyTotalEl.textContent = formatEuro(totals.total / installments);
  customerMonthlyDifferenceEl.textContent = formatEuro(totals.warrantyTotal / installments);
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

function formatPercent(value) {
  return new Intl.NumberFormat("hr-HR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(value);
}

function formatInstallments(value) {
  const installments = Number(value);
  const lastTwoDigits = installments % 100;
  const lastDigit = installments % 10;
  const noun = lastTwoDigits >= 12 && lastTwoDigits <= 14
    ? "rata"
    : lastDigit >= 2 && lastDigit <= 4
      ? "rate"
      : "rata";

  return `${installments} ${noun}`;
}

function formatEuro(value) {
  return new Intl.NumberFormat("hr-HR", {
    style: "currency",
    currency: "EUR"
  }).format(value);
}
