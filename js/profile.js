

const API_URL = "https://project-bj-api.aaabawgte.workers.dev";
const token = localStorage.getItem("token");

if (!token) {
  window.location.href = "../index.html";
}

loadProfile();

async function loadProfile() {
  try {
    const response = await fetch(`${API_URL}/profile`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error("Failed to load profile");
    }

    const profile = await response.json();

    document.querySelector("#profile-username").textContent = profile.username || "-";
    document.querySelector("#profile-role").textContent = profile.role || "-";
    document.querySelector("#profile-status").textContent = profile.status || "-";

    document.querySelector("#profile-count").textContent = profile.warrantyCount || 0;
    document.querySelector("#profile-revenue").textContent = formatEuro(profile.warrantyRevenue || 0);
    document.querySelector("#profile-average").textContent = formatEuro(profile.averageWarrantyPrice || 0);
    document.querySelector("#profile-highest").textContent = formatEuro(profile.highestWarrantyPrice || 0);

    document.querySelector("#profile-top-warranty").textContent = profile.topWarranty || "-";
    document.querySelector("#profile-notes").textContent = profile.notesCount || 0;

    if (profile.lastWarranty) {
      document.querySelector("#profile-last").textContent =
        `${profile.lastWarranty.warranty_type} (${formatEuro(profile.lastWarranty.warranty_price || 0)})`;
    }

    if (profile.createdAt) {
      const created = new Date(profile.createdAt);
      const days = Math.max(
        0,
        Math.floor((Date.now() - created.getTime()) / 86400000)
      );

      document.querySelector("#profile-days").textContent = `${days} dana`;
    }
  } catch (error) {
    console.error(error);
    alert("Greška kod učitavanja profila.");
  }
}

function formatEuro(value) {
  return new Intl.NumberFormat("hr-HR", {
    style: "currency",
    currency: "EUR"
  }).format(Number(value || 0));
}