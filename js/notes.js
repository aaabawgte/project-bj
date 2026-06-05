
const API_URL = "https://project-bj-api.aaabawgte.workers.dev";

const token = localStorage.getItem("token");
const notesGrid = document.querySelector("#notes-grid");
const notesEmpty = document.querySelector("#notes-empty");

const newNoteButton = document.querySelector("#new-note-btn");
const noteEditor = document.querySelector("#note-editor");
const noteTitleInput = document.querySelector("#note-title");
const noteContentInput = document.querySelector("#note-content");
const saveNoteButton = document.querySelector("#save-note-btn");
const cancelNoteButton = document.querySelector("#cancel-note-btn");
const closeNoteEditorButton = document.querySelector("#close-note-editor");

let noteViewer = null;

let notes = [];
let activeNoteId = null;

if (!token) {
  window.location.href = "../index.html";
} else {
  loadNotes();
}

newNoteButton?.addEventListener("click", openCreateNoteEditor);
saveNoteButton?.addEventListener("click", saveNote);
cancelNoteButton?.addEventListener("click", closeEditor);
closeNoteEditorButton?.addEventListener("click", closeEditor);

notesGrid?.addEventListener("click", (event) => {
  const card = event.target.closest(".note-card[data-id]");

  if (!card) {
    return;
  }

  openNoteViewer(card.dataset.id);
});

async function loadNotes() {
  try {
    const response = await fetch(`${API_URL}/notes`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error("Failed to load notes");
    }

    notes = await response.json();
    renderNotes();
  } catch (error) {
    console.error(error);
  }
}

function openCreateNoteEditor() {
  activeNoteId = null;
  noteTitleInput.value = "";
  noteContentInput.value = "";
  noteEditor.hidden = false;
  noteTitleInput.focus();
}

function openEditNoteEditor(noteId) {
  const note = notes.find(item => String(item.id) === String(noteId));

  if (!note) {
    return;
  }

  activeNoteId = note.id;
  noteTitleInput.value = note.title;
  noteContentInput.value = note.content || "";
  noteEditor.hidden = false;
  noteTitleInput.focus();
}

function closeEditor() {
  noteEditor.hidden = true;
  activeNoteId = null;
}

async function saveNote() {
  const title = noteTitleInput.value.trim();

  if (!title) {
    alert("Upiši naslov bilješke.");
    return;
  }

  try {
    const url = activeNoteId ? `${API_URL}/notes/${activeNoteId}` : `${API_URL}/notes`;
    const method = activeNoteId ? "PUT" : "POST";

    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        title,
        content: noteContentInput.value
      })
    });

    if (!response.ok) {
      throw new Error("Failed to create note");
    }

    closeEditor();
    await loadNotes();
  } catch (error) {
    console.error(error);
    alert("Greška kod spremanja bilješke.");
  }
}

function renderNotes() {
  notesGrid.innerHTML = "";

  notesEmpty.hidden = notes.length > 0;

  notes.forEach(note => {
    const card = document.createElement("article");
    const preview = note.content?.trim() || "Prazna bilješka";

    card.className = "card note-card";
    card.dataset.id = note.id;

    card.innerHTML = `
      <h3>${escapeHtml(note.title)}</h3>
      <p class="note-preview">${formatPreview(preview)}</p>
      <p class="note-date">${formatDate(note.updated_at)}</p>
    `;

    notesGrid.appendChild(card);
  });
}

function openNoteViewer(noteId) {
  const note = notes.find(item => String(item.id) === String(noteId));

  if (!note) {
    return;
  }

  closeNoteViewer();

  noteViewer = document.createElement("div");
  noteViewer.className = "note-viewer";

  noteViewer.innerHTML = `
    <div class="card note-viewer-card">
      <div class="note-editor-header">
        <div>
          <h2>${escapeHtml(note.title)}</h2>
          <p class="text-muted">${formatDate(note.updated_at)}</p>
        </div>

        <button class="btn btn-secondary" data-note-action="close" type="button">
          Zatvori
        </button>
      </div>

      <div class="note-viewer-content">${formatNoteContent(note.content || "Prazna bilješka")}</div>

      <div class="note-editor-actions">
        <button class="btn btn-secondary" data-note-action="delete" type="button">
          Obriši
        </button>

        <button class="btn btn-primary" data-note-action="edit" type="button">
          Uredi
        </button>
      </div>
    </div>
  `;

  noteViewer.addEventListener("click", (event) => {
    const action = event.target.closest("[data-note-action]")?.dataset.noteAction;

    if (!action) {
      return;
    }

    if (action === "close") {
      closeNoteViewer();
    }

    if (action === "edit") {
      closeNoteViewer();
      openEditNoteEditor(note.id);
    }

    if (action === "delete") {
      deleteNote(note.id);
    }
  });

  document.body.appendChild(noteViewer);
}

function closeNoteViewer() {
  noteViewer?.remove();
  noteViewer = null;
}

async function deleteNote(noteId) {
  const confirmed = confirm("Obrisati ovu bilješku?");

  if (!confirmed) {
    return;
  }

  try {
    const response = await fetch(`${API_URL}/notes/${noteId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error("Failed to delete note");
    }

    closeNoteViewer();
    await loadNotes();
  } catch (error) {
    console.error(error);
    alert("Greška kod brisanja bilješke.");
  }
}

function formatPreview(value) {
  return formatNoteContent(shortenText(value, 90));
}

function formatNoteContent(value) {
  return escapeHtml(value).replace(/\n/g, "<br>");
}

function shortenText(value, maxLength) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength).trim()}...`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("hr-HR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}