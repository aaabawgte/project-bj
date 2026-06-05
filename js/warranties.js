

const API_URL = "https://project-bj-api.aaabawgte.workers.dev";


const token = localStorage.getItem("token");

const warrantyTypes = [
  "Produženo održavanje 3+2 god",
  "Produženo održavanje 2+3 god",
  "Produženo održavanje 5+2 god",
  "Produženo održavanje 2+3 god + zaštita od oštećenja 5 god",
  "Produženo održavanje 3+2 god + zaštita od oštećenja 5 god",
  "Produženo održavanje 5+2 god + zaštita od oštećenja 7 god",
  "Zaštita od oštećenja i loma 1 god",
  "Zaštita od oštećenja i loma 2 god",
  "Produženo održavanje 2+1 god",
  "Produženo održavanje 2+1 god - električni bicikli i romobili",
  "Produženo održavanje 2+1 god + zaštita od oštećenja 3 god - električni bicikli i romobili"
];

const newWarrantyButton = document.querySelector("#new-warranty-btn");
const warrantyEditor = document.querySelector("#warranty-editor");
const closeWarrantyEditorButton = document.querySelector("#close-warranty-editor");
const cancelWarrantyButton = document.querySelector("#cancel-warranty-btn");
const saveWarrantyButton = document.querySelector("#save-warranty-btn");

const receiptNumberInput = document.querySelector("#receipt-number");
const saleDateInput = document.querySelector("#sale-date");
const productNameInput = document.querySelector("#product-name");
const warrantyTypeInput = document.querySelector("#warranty-type");
const warrantyPriceInput = document.querySelector("#warranty-price-input");

const warrantiesList = document.querySelector("#warranties-list");
const warrantiesEmpty = document.querySelector("#warranties-empty");
const warrantyCountEl = document.querySelector("#warranty-count");
const warrantyTotalEl = document.querySelector("#warranty-total");

let soldWarranties = [];

populateWarrantyTypes();

if (!token) {
  window.location.href = "../index.html";
} else {
  loadSoldWarranties();
}

newWarrantyButton?.addEventListener("click", openEditor);
closeWarrantyEditorButton?.addEventListener("click", closeEditor);
cancelWarrantyButton?.addEventListener("click", closeEditor);
saveWarrantyButton?.addEventListener("click", saveWarranty);

warrantiesList?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-id]");

  if (!button) {
    return;
  }

  deleteWarranty(button.dataset.id);
});

function populateWarrantyTypes() {
  warrantyTypeInput.innerHTML = '<option value="">Odaberi tip jamstva</option>';

  warrantyTypes.forEach(type => {
    warrantyTypeInput.append(new Option(type, type));
  });
}

async function loadSoldWarranties() {
  try {
    const response = await fetch(`${API_URL}/sold-warranties`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error("Failed to load sold warranties");
    }

    soldWarranties = await response.json();
    renderSoldWarranties();
  } catch (error) {
    console.error(error);
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    window.location.href = "../index.html";
  }
}

function openEditor() {
  receiptNumberInput.value = "";
  saleDateInput.value = new Date().toISOString().slice(0, 10);
  productNameInput.value = "";
  warrantyTypeInput.value = "";
  warrantyPriceInput.value = "";

  warrantyEditor.hidden = false;
  receiptNumberInput.focus();
}

function closeEditor() {
  warrantyEditor.hidden = true;
}

async function saveWarranty() {
  const receiptNumber = receiptNumberInput.value.trim();
  const saleDate = saleDateInput.value;
  const productName = productNameInput.value.trim();
  const warrantyType = warrantyTypeInput.value.trim();
  const warrantyPrice = parsePrice(warrantyPriceInput.value);

  if (!receiptNumber || !saleDate || !productName || !warrantyType || !warrantyPrice || warrantyPrice <= 0) {
    alert("Popuni sva polja ispravno.");
    return;
  }

  try {
    const response = await fetch(`${API_URL}/sold-warranties`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        receiptNumber,
        saleDate,
        productName,
        warrantyType,
        warrantyPrice
      })
    });

    if (!response.ok) {
      throw new Error("Failed to save sold warranty");
    }

    closeEditor();
    await loadSoldWarranties();
  } catch (error) {
    console.error(error);
    alert("Greška kod spremanja jamstva.");
  }
}

async function deleteWarranty(id) {
  const confirmed = confirm("Obrisati ovo prodano jamstvo?");

  if (!confirmed) {
    return;
  }

  try {
    const response = await fetch(`${API_URL}/sold-warranties/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error("Failed to delete sold warranty");
    }

    await loadSoldWarranties();
  } catch (error) {
    console.error(error);
    alert("Greška kod brisanja jamstva.");
  }
}

function renderSoldWarranties() {
  warrantiesList.innerHTML = "";
  warrantiesEmpty.hidden = soldWarranties.length > 0;

  soldWarranties.forEach(warranty => {
    const row = document.createElement("article");

    row.className = "card warranty-row";

    row.innerHTML = `
      <div>
        <span>Račun</span>
        <strong>${escapeHtml(warranty.receipt_number)}</strong>
      </div>

      <div>
        <span>Datum</span>
        <strong>${formatDate(warranty.sale_date)}</strong>
      </div>

      <div>
        <span>Proizvod</span>
        <strong>${escapeHtml(warranty.product_name)}</strong>
      </div>

      <div>
        <span>Tip jamstva</span>
        <strong>${escapeHtml(warranty.warranty_type)}</strong>
      </div>

      <div class="warranty-price">
        ${formatEuro(warranty.warranty_price)}
      </div>

      <button class="btn btn-secondary" type="button" data-id="${warranty.id}">
        Obriši
      </button>
    `;

    warrantiesList.appendChild(row);
  });

  renderSummary();
}

function renderSummary() {
  const total = soldWarranties.reduce((sum, warranty) => sum + Number(warranty.warranty_price), 0);

  warrantyCountEl.textContent = soldWarranties.length;
  warrantyTotalEl.textContent = formatEuro(total);
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