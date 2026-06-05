

const API_URL = "https://project-bj-api.aaabawgte.workers.dev";

const token = localStorage.getItem("token");
const logoutButton = document.querySelector("#logout-btn");

if (!token) {
  window.location.href = "../index.html";
}

checkSession();

logoutButton?.addEventListener("click", async () => {
  try {
    await fetch(`${API_URL}/logout`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  } catch (error) {
    console.error(error);
  }

  localStorage.removeItem("token");
  localStorage.removeItem("username");
  window.location.href = "../index.html";
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

    const data = await response.json();

    if (!data.authenticated) {
      throw new Error("Not authenticated");
    }
  } catch (error) {
    console.error(error);
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    window.location.href = "../index.html";
  }
}