// The pantry screen: what's at home, by section, with Have/Low/Out.
import { pantry, addItem, cycleStatus, addStaples, sectionNames } from "../pantryState.js";
import { ask } from "./ask.js";
import * as shopping from "../shoppingState.js";
import { groupPantry, lowOrOut, OTHER_SECTION, STATUS_LABELS } from "../lib/pantry.js";
import { nameKey } from "../lib/shopping.js";
import { setBadge } from "./tabs.js";
import { showToast } from "./toast.js";

const restock = document.getElementById("pantry-restock");
const toShoppingButton = document.getElementById("pantry-to-shopping");
const addForm = document.getElementById("pantry-add");
const addInput = document.getElementById("pantry-add-input");
const filterBar = document.getElementById("pantry-filter");
const sections = document.getElementById("pantry-sections");
const empty = document.getElementById("pantry-empty");
const noneLow = document.getElementById("pantry-none-low");
const staplesButton = document.getElementById("pantry-staples");
const dialog = document.getElementById("pantry-dialog");
const form = document.getElementById("pantry-form");
const titleInput = document.getElementById("pantry-title");
const sectionSelect = document.getElementById("pantry-section");
const deleteButton = document.getElementById("pantry-delete");

let filter = "all"; // "all" or "low"
let editingId = null;

// Low or out, and not already waiting on the shopping list.
function needToBuy() {
  const list = shopping.getCurrent();
  const onList = new Set(
    Object.values(list ? list.items : {})
      .filter((item) => !item.removed && !item.checked)
      .map((item) => nameKey(item.name))
  );
  return lowOrOut(pantry.getAll()).filter((item) => !onList.has(nameKey(item.title)));
}

export function renderPantryBadge() {
  setBadge("pantry-count", lowOrOut(pantry.getAll()).length);
}

function itemRow(item) {
  const row = document.createElement("li");
  row.className = "pantry-item status-" + item.status;

  const name = document.createElement("button");
  name.type = "button";
  name.className = "pantry-name";
  name.textContent = item.title;
  name.title = "Rename, move or delete";
  name.addEventListener("click", () => openItem(item.id));

  const status = document.createElement("button");
  status.type = "button";
  status.className = "status-pill";
  status.textContent = STATUS_LABELS[item.status];
  status.title = "Tap to change: Have → Low → Out";
  status.setAttribute("aria-label", item.title + ": " + STATUS_LABELS[item.status] + ". Tap to change.");
  status.addEventListener("click", () => cycleStatus(item.id));

  row.append(name, status);
  return row;
}

export function renderPantry() {
  document.title = "Pantry · Kitchen";
  const all = pantry.getAll();
  const shown = filter === "low" ? lowOrOut(all) : all;

  const toBuy = needToBuy();
  restock.hidden = toBuy.length === 0;
  toShoppingButton.textContent = "Restock: add " + toBuy.length + " to shopping";

  for (const button of filterBar.querySelectorAll("button[data-filter]")) {
    const on = button.dataset.filter === filter;
    button.classList.toggle("selected", on);
    button.setAttribute("aria-pressed", on ? "true" : "false");
  }
  filterBar.hidden = all.length === 0;

  sections.replaceChildren();
  for (const group of groupPantry(shown, sectionNames())) {
    const section = document.createElement("section");
    section.className = "shop-section";
    const heading = document.createElement("h2");
    heading.textContent = group.section;
    const list = document.createElement("ul");
    list.className = "shop-items";
    for (const item of group.items) {
      list.appendChild(itemRow(item));
    }
    section.append(heading, list);
    sections.appendChild(section);
  }

  empty.hidden = all.length > 0;
  noneLow.hidden = !(all.length > 0 && filter === "low" && shown.length === 0);
  renderPantryBadge();
}

function openItem(id) {
  const item = pantry.get(id);
  if (!item) {
    return;
  }
  editingId = id;
  titleInput.value = item.title;
  // Built here, as the categories can change.
  const names = sectionNames();
  sectionSelect.replaceChildren(...names.map((name) => new Option(name, name)));
  sectionSelect.value = names.includes(item.section) ? item.section : OTHER_SECTION;
  dialog.returnValue = "";
  dialog.showModal();
}

export function focusPantryAdd() {
  addInput.focus();
}

export function initPantry() {
  addForm.addEventListener("submit", function (event) {
    event.preventDefault();
    const before = pantry.getAll().length;
    const item = addItem(addInput.value);
    if (item && pantry.getAll().length === before) {
      showToast(item.title + " is already in the pantry");
    }
    addInput.value = "";
  });

  filterBar.addEventListener("click", function (event) {
    const button = event.target.closest("button[data-filter]");
    if (button) {
      filter = button.dataset.filter;
      renderPantry();
    }
  });

  toShoppingButton.addEventListener("click", function () {
    let added = 0;
    for (const item of needToBuy()) {
      if (shopping.addOwnItem(item.title, { pantryId: item.id })) {
        added++;
      }
    }
    showToast("Added " + added + " to the shopping list");
  });

  staplesButton.addEventListener("click", function () {
    const added = addStaples();
    showToast("Added " + added + " staples. Delete what you don't keep.");
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    const submitter = event.submitter;
    if (submitter && submitter.value === "cancel") {
      dialog.close();
      return;
    }
    if (!form.reportValidity()) {
      return;
    }
    pantry.update(editingId, { title: titleInput.value.trim(), section: sectionSelect.value });
    dialog.close();
  });

  deleteButton.addEventListener("click", function () {
    const item = pantry.get(editingId);
    if (!item) {
      return;
    }
    ask("Remove " + item.title + " from the pantry?", "Remove", true).then(function (yes) {
      if (yes) {
        pantry.remove(item.id);
        dialog.close();
      }
    });
  });
}
