

const API_URL = "https://project-bj-api.aaabawgte.workers.dev";

const token = localStorage.getItem("token");

const newOfferButton = document.querySelector("#new-offer-btn");
const offerFormCard = document.querySelector("#offer-form-card");
const offerForm = document.querySelector("#offer-form");
const offersList = document.querySelector("#offers-list");

const titleInput = document.querySelector("#offer-title");
const discountInput = document.querySelector("#offer-discount");
const conditionsInput = document.querySelector("#offer-conditions");
const durationInput = document.querySelector("#offer-duration");

let offers = [];
let isAdmin = false;
let activeOfferId = null;

if (!token) {
  window.location.href = "../index.html";
} else {
  initOffers();
}

newOfferButton?.addEventListener("click", () => {
  openOfferForm();
});

offerForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  await saveOffer();
});

offersList?.addEventListener("click", async (event) => {
  const editButton = event.target.closest("[data-action='edit']");
  const deleteButton = event.target.closest("[data-action='delete']");

  if (editButton) {
    openOfferForm(editButton.dataset.id);
  }

  if (deleteButton) {
    await deleteOffer(deleteButton.dataset.id);
  }
});

async function initOffers() {
  await checkSession();
  await loadOffers();
}

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

    const data = await response.json();
    isAdmin = data.role === "admin";

    if (newOfferButton && isAdmin) {
      newOfferButton.hidden = false;
    }
  } catch (error) {
    console.error(error);
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    window.location.href = "../index.html";
  }
}

async function loadOffers() {
  try {
    const response = await fetch(`${API_URL}/offers`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error("Failed to load offers");
    }

    offers = await response.json();
    renderOffers();
  } catch (error) {
    console.error(error);
    offersList.innerHTML = `<p class="text-muted">Greška kod učitavanja ponuda.</p>`;
  }
}

function openOfferForm(offerId = null) {
  activeOfferId = offerId;

  if (!offerId) {
    titleInput.value = "";
    discountInput.value = "";
    conditionsInput.value = "";
    durationInput.value = "";
  } else {
    const offer = offers.find(item => String(item.id) === String(offerId));

    if (!offer) {
      return;
    }

    titleInput.value = offer.title || "";
    discountInput.value = offer.discount || "";
    conditionsInput.value = offer.conditions || "";
    durationInput.value = offer.duration || "";
  }

  offerFormCard.hidden = false;
  titleInput.focus();
}

async function saveOffer() {
  const title = titleInput.value.trim();
  const discount = discountInput.value.trim();
  const conditions = conditionsInput.value.trim();
  const duration = durationInput.value.trim();

  if (!title || !discount) {
    alert("Naziv ponude i iznos popusta su obavezni.");
    return;
  }

  try {
    const url = activeOfferId ? `${API_URL}/offers/${activeOfferId}` : `${API_URL}/offers`;
    const method = activeOfferId ? "PUT" : "POST";

    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        title,
        discount,
        conditions,
        duration
      })
    });

    if (!response.ok) {
      throw new Error("Failed to save offer");
    }

    offerForm.reset();
    offerFormCard.hidden = true;
    activeOfferId = null;
    await loadOffers();
  } catch (error) {
    console.error(error);
    alert("Greška kod spremanja ponude.");
  }
}

async function deleteOffer(offerId) {
  const confirmed = confirm("Obrisati ovu ponudu?");

  if (!confirmed) {
    return;
  }

  try {
    const response = await fetch(`${API_URL}/offers/${offerId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error("Failed to delete offer");
    }

    await loadOffers();
  } catch (error) {
    console.error(error);
    alert("Greška kod brisanja ponude.");
  }
}

function renderOffers() {
  if (!offers.length) {
    offersList.innerHTML = `<p class="text-muted">Nema trenutnih ponuda.</p>`;
    return;
  }

  offersList.innerHTML = offers.map(offer => `
    <article class="card note-card offer-card">
      <h3>${escapeHtml(offer.title)}</h3>
      <p class="offer-discount">${escapeHtml(offer.discount)}</p>
      ${offer.conditions ? `<p class="note-preview">${escapeHtml(offer.conditions)}</p>` : ""}
      ${offer.duration ? `<p class="note-date">Trajanje: ${escapeHtml(offer.duration)}</p>` : ""}
      <p class="note-date">Objavio: ${escapeHtml(offer.username || "admin")}</p>

      ${isAdmin ? `
        <div class="offer-actions">
          <button class="btn btn-secondary" type="button" data-action="edit" data-id="${offer.id}">
            Uredi
          </button>

          <button class="btn btn-secondary" type="button" data-action="delete" data-id="${offer.id}">
            Obriši
          </button>
        </div>
      ` : ""}
    </article>
  `).join("");
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}