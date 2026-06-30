const currentUser = JSON.parse(localStorage.getItem("user") || "null");

if (!currentUser) {
    window.location.href = "index.html";
}

const adminTiles = document.querySelectorAll(".admin-shift-tile");

if (
    currentUser &&
    (currentUser.role === "admin" || currentUser.role === "superadmin")
) {
    adminTiles.forEach(tile => {
        tile.hidden = false;
    });
}
