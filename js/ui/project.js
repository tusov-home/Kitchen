// One project: status, steps checklist, things to buy, notes.
import { projects, setStatus, addEntry, toggleEntry, removeEntry } from "../projectsState.js";
import * as shopping from "../shoppingState.js";
import { entryList, progress, materialsToBuy, STATUS_LABELS } from "../lib/projects.js";
import { nameKey } from "../lib/shopping.js";
import { dueLabel, toDateString } from "../lib/dates.js";
import { projectSummary, openProjectDialog } from "./projects.js";
import { goBack } from "./router.js";
import { showToast } from "./toast.js";

const title = document.getElementById("project-title");
const meta = document.getElementById("project-meta");
const statusBar = document.getElementById("project-status");
const progressText = document.getElementById("project-progress");
const stepsList = document.getElementById("project-steps");
const stepForm = document.getElementById("project-step-add");
const stepInput = document.getElementById("project-step-input");
const materialsList = document.getElementById("project-materials");
const materialForm = document.getElementById("project-material-add");
const materialInput = document.getElementById("project-material-input");
const toShoppingButton = document.getElementById("project-to-shopping");
const notesInput = document.getElementById("project-notes");
const editButton = document.getElementById("project-edit");
const backButton = document.getElementById("project-back");

let currentId = null;

// Names of things waiting on the shopping list (not ticked yet).
function onShoppingList() {
  const list = shopping.getCurrent();
  return new Set(
    Object.values(list ? list.items : {})
      .filter((item) => !item.removed && !item.checked)
      .map((item) => nameKey(item.name))
  );
}

// listName: "steps" or "materials"; flag: "done" or "bought".
function entryRow(listName, flag, entry, extra) {
  const row = document.createElement("li");
  row.className = "shop-item" + (entry[flag] ? " checked" : "");
  const label = document.createElement("label");
  label.className = "shop-check";
  const box = document.createElement("input");
  box.type = "checkbox";
  box.checked = entry[flag];
  box.addEventListener("change", () => toggleEntry(currentId, listName, entry.key));
  const text = document.createElement("span");
  text.className = "shop-text";
  const name = document.createElement("span");
  name.className = "shop-name";
  name.textContent = entry.text;
  text.appendChild(name);
  if (extra) {
    const note = document.createElement("span");
    note.className = "shop-from";
    note.textContent = extra;
    text.appendChild(note);
  }
  label.append(box, text);
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "shop-remove";
  remove.textContent = "×";
  remove.title = "Remove";
  remove.setAttribute("aria-label", "Remove " + entry.text);
  remove.addEventListener("click", () => removeEntry(currentId, listName, entry.key));
  row.append(label, remove);
  return row;
}

// Returns false if the project doesn't exist (e.g. deleted on the other phone).
export function renderProject(id) {
  const project = projects.get(id);
  if (!project) {
    return false;
  }
  const switched = id !== currentId;
  currentId = id;
  document.title = project.title + " · Kitchen";
  title.textContent = project.title;
  let summary = projectSummary(project);
  if (project.status === "done" && project.doneAt) {
    summary += " · finished " + dueLabel(project.doneAt, toDateString(new Date())).toLowerCase();
  }
  meta.textContent = summary;

  for (const button of statusBar.querySelectorAll("button")) {
    const on = button.dataset.status === project.status;
    button.classList.toggle("active", on);
    button.setAttribute("aria-pressed", on ? "true" : "false");
  }

  const p = progress(project);
  progressText.textContent = p.total ? p.done + " of " + p.total + " done" : "";
  stepsList.replaceChildren(...entryList(project.steps).map((e) => entryRow("steps", "done", e)));
  stepsList.hidden = p.total === 0;

  const waiting = onShoppingList();
  const materials = entryList(project.materials);
  materialsList.replaceChildren(
    ...materials.map((e) => entryRow("materials", "bought", e, e.bought ? "" : waiting.has(nameKey(e.text)) ? "On the shopping list" : ""))
  );
  materialsList.hidden = materials.length === 0;
  const toAdd = materialsToBuy(project).filter((m) => !waiting.has(nameKey(m.text)));
  toShoppingButton.hidden = toAdd.length === 0;
  toShoppingButton.textContent = "Add " + toAdd.length + " to shopping list";

  // Don't overwrite notes while someone is typing in them.
  if (switched || document.activeElement !== notesInput) {
    notesInput.value = project.notes;
  }
  return true;
}

function saveNotes() {
  const project = projects.get(currentId);
  if (project && notesInput.value !== project.notes) {
    projects.update(currentId, { notes: notesInput.value });
  }
}

export function editCurrentProject() {
  if (currentId) {
    openProjectDialog(currentId);
  }
}

export function initProject() {
  statusBar.addEventListener("click", function (event) {
    const button = event.target.closest("button[data-status]");
    if (!button || !currentId) {
      return;
    }
    const before = projects.get(currentId).status;
    if (before === button.dataset.status) {
      return;
    }
    setStatus(currentId, button.dataset.status);
    if (button.dataset.status === "done") {
      showToast("Well done.", { label: "Undo", run: () => setStatus(currentId, before) });
    } else {
      showToast("Moved to " + STATUS_LABELS[button.dataset.status]);
    }
  });

  stepForm.addEventListener("submit", function (event) {
    event.preventDefault();
    addEntry(currentId, "steps", stepInput.value);
    stepInput.value = "";
    stepInput.focus();
  });

  materialForm.addEventListener("submit", function (event) {
    event.preventDefault();
    addEntry(currentId, "materials", materialInput.value);
    materialInput.value = "";
    materialInput.focus();
  });

  toShoppingButton.addEventListener("click", function () {
    const project = projects.get(currentId);
    const waiting = onShoppingList();
    let added = 0;
    for (const material of materialsToBuy(project)) {
      if (!waiting.has(nameKey(material.text)) &&
          shopping.addOwnItem(material.text, { projectId: project.id, materialKey: material.key, sources: [project.title] })) {
        added++;
      }
    }
    showToast("Added " + added + " to the shopping list");
  });

  // Notes save when you leave the box, and after a short pause in typing.
  let timer = null;
  notesInput.addEventListener("input", function () {
    clearTimeout(timer);
    timer = setTimeout(saveNotes, 800);
  });
  notesInput.addEventListener("blur", saveNotes);

  editButton.addEventListener("click", editCurrentProject);
  backButton.addEventListener("click", function (event) {
    event.preventDefault();
    saveNotes();
    goBack("#/projects");
  });
}
