

const API_URL = "https://project-bj-api.aaabawgte.workers.dev";

const form = document.querySelector("#register-form");
const usernameInput = document.querySelector("#username");
const passwordInput = document.querySelector("#password");
const messageEl = document.querySelector("#register-message");

form?.addEventListener("submit", handleRegister);

async function handleRegister(event) {
  event.preventDefault();

  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  messageEl.textContent = "Slanje zahtjeva...";

  try {
    const response = await fetch(`${API_URL}/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username,
        password
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Greška kod registracije");
    }

    form.reset();

    messageEl.textContent =
      "Registracija uspješna. Račun čeka odobrenje administratora.";
  } catch (error) {
    messageEl.textContent = error.message;
  }
}