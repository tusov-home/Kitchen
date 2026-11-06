// The "Pantry categories" dialog: add, rename, reorder and remove the
// categories the pantry is grouped by. "Other" stays as the catch-all.
import {
  getSections, addSection, renameSection, removeSection, moveSection, itemsInSection,
} from "../pantryState.js";
import { OTHER_SECTION } from "../lib/pantry.js";

const openButton = document.getElementById("sections-open");
const dialog = document.getElementById("sections-dialog");
const form = document.getElementById("sections-form");
const list = document.getElementById("sections-list");
const note = document.getElementById("sections-note");
const addInput = document.getElementById("sections-add-input");
const addButton = document.getElementById("sections-add");

const ICONS = {
  up: '<path d="M6 14.5l6-6 6 6"/>',
  down: '<path d="M6 9.5l6 6 6-6"/>',
  remove: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
};

function say(text) {
  note.textContent = text;
  note.hidden = !text;
}

function iconButton(action, label, disabled, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "icon-button section-action";
  button.dataset.action = action;
  button.title = label;
  button.setAttribute("aria-label", label);
  button.disabled = disabled;
  button.innerHTML = '<svg class="line-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + ICONS[action] + "</svg>";
  button.addEventListener("click", onClick);
  return button;
}

function row(section, index, count) {
  const item = document.createElement("li");
  item.className = "section-row";
  item.dataset.id = section.id;

  const name = document.createElement("input");
  name.type = "text";
  name.value = section.title;
  name.maxLength = 40;
  name.autocomplete = "off";
  name.setAttribute("aria-label", "Name of " + section.title);
  name.addEventListener("change", function () {
    const problem = renameSection(section.id, name.value);
    say(problem);
    render();
  });

  const up = iconButton("up", "Move " + section.title + " up", index === 0, () => move(section.id, -1, "up"));
  const down = iconButton("down", "Move " + section.title + " down", index === count - 1, () => move(section.id, 1, "down"));
  const remove = iconButton("remove", "Remove " + section.title, false, () => removeRow(section));
  item.append(name, up, down, remove);
  return item;
}

function move(id, direction, action) {
  moveSection(id, direction);
  render();
  // Keep the focus on the same arrow, to press it again.
  const button = list.querySelector('[data-id="' + id + '"] [data-action="' + action + '"]');
  if (button && !button.disabled) {
    button.focus();
  }
}

function removeRow(section) {
  const items = itemsInSection(section.title);
  const question = items
    ? "Remove " + section.title + "? " + items + (items === 1 ? " item moves" : " items move") + " to " + OTHER_SECTION + "."
    : "Remove " + section.title + "?";
  if (confirm(question)) {
    removeSection(section.id);
    say("");
    render();
  }
}

function render() {
  const sections = getSections().filter((section) => section.title !== OTHER_SECTION);
  list.replaceChildren(...sections.map((section, index) => row(section, index, sections.length)));
}

function add() {
  const problem = addSection(addInput.value);
  say(problem);
  if (!problem) {
    addInput.value = "";
    render();
  }
}

export function openSections() {
  say("");
  addInput.value = "";
  render();
  dialog.returnValue = "";
  dialog.showModal();
}

export function initPantrySections() {
  openButton.addEventListener("click", openSections);
  addButton.addEventListener("click", add);
  // Enter in a box means "this box is done", not "close the dialog".
  form.addEventListener("keydown", function (event) {
    if (event.key !== "Enter" || event.target.tagName !== "INPUT") {
      return;
    }
    event.preventDefault();
    if (event.target === addInput) {
      add();
    } else {
      event.target.blur();
    }
  });
}
