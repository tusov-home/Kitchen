// "Whose phone is this?" Each phone remembers one name. It's used for
// star ratings and to mark who owns a recipe.
import * as storage from "../storage.js";

const dialog = document.getElementById("name-dialog");
const form = document.getElementById("name-form");
const input = document.getElementById("name-input");
const cancel = document.getElementById("name-cancel");

// What to do once the name is saved (e.g. finish saving a recipe).
let afterName = null;

export function getMyName() {
  return storage.loadSettings().myName;
}

export function setMyName(name) {
  storage.saveSettings(Object.assign(storage.loadSettings(), { myName: name.trim() }));
}

// Runs onDone(name) right away if the name is known; otherwise asks first.
export function withMyName(onDone) {
  const name = getMyName();
  if (name) {
    onDone(name);
    return;
  }
  afterName = onDone;
  input.value = "";
  dialog.showModal();
}

export function initName() {
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    const name = input.value.trim();
    if (!name) {
      return;
    }
    setMyName(name);
    dialog.close();
    if (afterName) {
      const next = afterName;
      afterName = null;
      next(name);
    }
  });
  cancel.addEventListener("click", function () {
    afterName = null;
    dialog.close();
  });
}
