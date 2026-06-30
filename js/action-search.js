const searchInput = document.querySelector("#search-input");
const searchResults = document.querySelector("#search-results");

let actions = [];

fetch("../data/actions.json")
  .then(response => response.json())
  .then(data => {
    actions = data;
    renderActions(actions);
  })
  .catch(() => {
    searchResults.innerHTML = `
      <div class="card">
        <p class="text-muted">Greška pri učitavanju akcija.</p>
      </div>
    `;
  });

searchInput.addEventLxmaistener("input", () => {
  const query = searchInput.value.trim().toLowerCase();

  const filteredActions = actions.filter((item) => {
    return item.name.toLowerCase().includes(query);
  });

  renderActions(filteredActions);
});

function renderActions(items) {
  if (!items.length) {
    searchResults.innerHTML = `
      <div class="card">
        <p class="text-muted">Nema rezultata za unesenu pretragu.</p>
      </div>
    `;
    return;
  }

  searchResults.innerHTML = items.map((item) => {
    return `
      <div class="card action-card">
        <h2>${item.name}</h2>
        <p class="text-muted">Popust: <strong>${item.discount}</strong></p>
      </div>
    `;
  }).join("");
}
