// The chores screen: what's due, grouped by when, tick off when done.
import * as state from "../state.js";
import { chores, today, markDone, markNotDone, clearDone } from "../choresState.js";
import { allOwners } from "../lib/recipes.js";
import {
  groupChores, dueLabel, repeatLabel, repeatKey, dueNowCount, REPEAT_PRESETS, toDateString,
} from "../lib/chores.js";
import { getMyName, withMyName } from "./name.js";
import { setBadge } from "./tabs.js";
import { showToast } from "./toast.js";
import * as storage from "../storage.js";

const filterBar = document.getElementById("chores-filter");
const groupsBox = document.getElementById("chores-groups");
const empty = document.getElementById("chores-empty");
const footer = document.getElementById("chores-footer");
const clearDoneButton = document.getElementById("chores-clear-done");
const addButton = document.getElementById("chore-add");

const dialog = document.getElementById("chore-dialog");
const form = document.getElementById("chore-form");
const dialogTitle = document.getElementById("chore-dialog-title");
const titleInput = document.getElementById("chore-title");
const whoSelect = document.getElementById("chore-who");
const repeatSelect = document.getElementById("chore-repeat");
const customBox = document.getElementById("chore-custom");
const everyInput = document.getElementById("chore-every");
const unitSelect = document.getElementById("chore-unit");
const dueInput = document.getElementById("chore-due");
const dueHint = document.getElementById("chore-due-hint");
const lastLine = document.getElementById("chore-last");
const deleteButton = document.getElementById("chore-delete");

// Whose chores to show; remembered on this phone.
let who = storage.loadSettings().choresWho || "";
let editingId = null;

// Everyone we know: this phone's name, recipe owners, people on chores.
function knownNames() {
  const names = new Set(allOwners(state.getRecipes()));
  const mine = getMyName();
  if (mine) {
    names.add(mine);
  }
  for (const chore of chores.getAll()) {
    if (chore.who) {
      names.add(chore.who);
    }
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

export function renderChoresBadge() {
  setBadge("chores-count", dueNowCount(chores.getAll(), today(), ""));
}

function chip(label, selected, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "tag" + (selected ? " selected" : "");
  button.textContent = label;
  button.setAttribute("aria-pressed", selected ? "true" : "false");
  button.addEventListener("click", onClick);
  return button;
}

function choreRow(chore, now) {
  const row = document.createElement("li");
  row.className = "shop-item chore" + (chore.done ? " checked" : "");

  const box = document.createElement("input");
  box.type = "checkbox";
  box.checked = chore.done;
  box.className = "chore-check";
  box.setAttribute("aria-label", (chore.done ? "Not done: " : "Done: ") + chore.title);
  box.addEventListener("change", () => toggle(chore.id));

  const text = document.createElement("button");
  text.type = "button";
  text.className = "chore-text";
  text.title = "Edit";
  const name = document.createElement("span");
  name.className = "shop-name";
  name.textContent = chore.title;
  const meta = document.createElement("span");
  meta.className = "shop-from chore-meta";
  const late = !chore.done && chore.due && chore.due < now;
  const parts = [];
  if (chore.due && !chore.done) {
    const due = document.createElement("span");
    due.className = late ? "due late" : chore.due === now ? "due today" : "due";
    due.textContent = dueLabel(chore.due, now);
    parts.push(due);
  }
  parts.push(chore.who || "Anyone");
  if (chore.repeat) {
    parts.push("↻ " + repeatLabel(chore.repeat).toLowerCase());
  }
  parts.forEach(function (part, index) {
    if (index > 0) {
      meta.append(" · ");
    }
    meta.append(part);
  });
  text.append(name, meta);
  text.addEventListener("click", () => openChore(chore.id));

  row.append(box, text);
  return row;
}

export function renderChores() {
  document.title = "Chores · Kitchen";
  const now = today();
  const all = chores.getAll();

  // Person filter, once there are names to choose from.
  const names = knownNames();
  if (who && !names.includes(who)) {
    who = "";
  }
  filterBar.replaceChildren();
  filterBar.hidden = names.length === 0 || all.length === 0;
  for (const name of ["", ...names]) {
    filterBar.appendChild(
      chip(name || "Everyone", name === who, function () {
        who = name;
        storage.saveSettings(Object.assign(storage.loadSettings(), { choresWho: who }));
        renderChores();
      })
    );
  }

  groupsBox.replaceChildren();
  for (const group of groupChores(all, now, who)) {
    const section = document.createElement("section");
    section.className = "shop-section chore-group group-" + group.group.toLowerCase().replace(/\s+/g, "-");
    const heading = document.createElement("h2");
    heading.textContent = group.group;
    const list = document.createElement("ul");
    list.className = "shop-items";
    for (const chore of group.chores) {
      list.appendChild(choreRow(chore, now));
    }
    section.append(heading, list);
    groupsBox.appendChild(section);
  }

  empty.hidden = all.length > 0;
  footer.hidden = !all.some((c) => c.done);
  renderChoresBadge();
}

function toggle(id) {
  const chore = chores.get(id);
  if (!chore) {
    return;
  }
  if (chore.done) {
    markNotDone(id);
    return;
  }
  const before = Object.assign({}, chore);
  withMyName(function (name) {
    const saved = markDone(id, name);
    const message = saved.repeat ? "Done! Next: " + dueLabel(saved.due, today()) : "Done!";
    showToast(message, { label: "Undo", run: () => chores.put(before) });
  });
}

// ---------- Add / edit dialog ----------

function fillWho(selected) {
  whoSelect.replaceChildren(new Option("Anyone", ""));
  const names = knownNames();
  if (selected && !names.includes(selected)) {
    names.push(selected);
  }
  for (const name of names) {
    whoSelect.add(new Option(name, name));
  }
  whoSelect.value = selected || "";
}

function updateRepeatFields() {
  customBox.hidden = repeatSelect.value !== "custom";
  const once = repeatSelect.value === "once";
  dueHint.textContent = once ? "leave empty for any time" : "next time it's due";
}

export function openChore(id) {
  const chore = id ? chores.get(id) : null;
  editingId = chore ? chore.id : null;
  dialogTitle.textContent = chore ? "Edit chore" : "Add chore";
  titleInput.value = chore ? chore.title : "";
  fillWho(chore ? chore.who : "");
  const key = chore ? repeatKey(chore.repeat) : "1-week";
  repeatSelect.value = key;
  if (chore && chore.repeat) {
    everyInput.value = chore.repeat.every;
    unitSelect.value = chore.repeat.unit;
  }
  dueInput.value = chore ? chore.due || "" : toDateString(new Date());
  updateRepeatFields();
  lastLine.hidden = !(chore && chore.lastDone);
  if (chore && chore.lastDone) {
    lastLine.textContent = "Last done " + dueLabel(chore.lastDone, today()).toLowerCase() +
      (chore.lastDoneBy ? " by " + chore.lastDoneBy : "");
  }
  deleteButton.hidden = !chore;
  dialog.returnValue = "";
  dialog.showModal();
}

function repeatFromForm() {
  if (repeatSelect.value === "custom") {
    const every = Math.max(1, Math.min(365, Math.round(Number(everyInput.value) || 1)));
    return { every: every, unit: unitSelect.value };
  }
  const preset = REPEAT_PRESETS.find(([key]) => key === repeatSelect.value);
  return preset ? preset[1] : null;
}

export function initChores() {
  addButton.addEventListener("click", () => openChore(null));
  repeatSelect.addEventListener("change", updateRepeatFields);

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (event.submitter && event.submitter.value === "cancel") {
      dialog.close();
      return;
    }
    if (!form.reportValidity()) {
      return;
    }
    const existing = editingId ? chores.get(editingId) : null;
    const repeat = repeatFromForm();
    chores.put(Object.assign({}, existing || {}, {
      title: titleInput.value.trim(),
      who: whoSelect.value,
      repeat: repeat,
      due: dueInput.value || (repeat ? today() : null),
      done: repeat ? false : existing ? existing.done : false,
    }));
    dialog.close();
    showToast(existing ? "Chore saved" : "Chore added");
  });

  deleteButton.addEventListener("click", function () {
    const chore = chores.get(editingId);
    if (chore && confirm("Delete \"" + chore.title + "\"? This also removes it on the other phone.")) {
      chores.remove(editingId);
      dialog.close();
    }
  });

  clearDoneButton.addEventListener("click", function () {
    const count = clearDone();
    if (count) {
      showToast("Cleared " + count + " done");
    }
  });
}
