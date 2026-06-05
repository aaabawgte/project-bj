

const API_URL = "https://project-bj-api.aaabawgte.workers.dev";

const form = document.querySelector("#login-form");
const usernameInput = document.querySelector("#username");
const passwordInput = document.querySelector("#password");

form?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  if (!username || !password) {
    alert("Unesi korisničko ime i lozinku.");
    return;
  }

  try {
    const response = await fetch(`${API_URL}/login`, {
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
      alert(data.error || "Prijava nije uspjela.");
      return;
    }

    localStorage.setItem("token", data.token);
    localStorage.setItem("username", data.username);

    window.location.href = "pages/dashboard.html";
  } catch (error) {
    console.error(error);
    alert("Greška prilikom spajanja na server.");
  }
});