

const savedTheme = localStorage.getItem("theme") || "light";

applyTheme(savedTheme);

window.addEventListener("DOMContentLoaded", () => {
  const themeToggle = document.querySelector("#theme-toggle");

  updateThemeButton(themeToggle, savedTheme);

  themeToggle?.addEventListener("click", () => {
    const currentTheme = document.documentElement.dataset.theme || "light";
    const nextTheme = currentTheme === "dark" ? "light" : "dark";

    applyTheme(nextTheme);
    localStorage.setItem("theme", nextTheme);
    updateThemeButton(themeToggle, nextTheme);
  });
});

function applyTheme(theme) {
  if (theme === "dark") {
    document.documentElement.dataset.theme = "dark";
    return;
  }

  document.documentElement.dataset.theme = "light";
}

function updateThemeButton(button, theme) {
  if (!button) {
    return;
  }

  button.textContent = theme === "dark" ? "☀️" : "🌙";
  button.title = theme === "dark" ? "Svijetli način" : "Tamni način";
}