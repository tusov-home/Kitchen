// "Plan shopping" starts on the shopping page and opens the recipe list:
// tap recipes to pick them, then make a shopping list from them.
import * as state from "../state.js";
import * as shopping from "../shoppingState.js";
import { progress } from "../lib/shopping.js";
import { go, goBack } from "./router.js";
import { showToast } from "./toast.js";

const startButton = document.getElementById("plan-start");
const hint = document.getElementById("plan-hint");
const bar = document.getElementById("plan-bar");
const countText = document.getElementById("plan-count");
const cancelButton = document.getElementById("plan-cancel");
const makeButton = document.getElementById("plan-make");
const dialog = document.getElementById("make-list-dialog");
const dialogText = document.getElementById("make-list-text");

let planning = false;
const selected = new Set();
let rerender = function () {};

export function isPlanning() {
  return planning;
}

export function isSelected(id) {
  return selected.has(id);
}

export function toggleSelected(id) {
  if (selected.has(id)) {
    selected.delete(id);
  } else {
    selected.add(id);
  }
  renderBar();
  rerender();
}

export function setPlanning(on) {
  planning = on;
  if (!on) {
    selected.clear();
  }
  document.body.classList.toggle("planning", on);
  renderBar();
  rerender();
}

// From the shopping page to the recipe list, picking.
export function startPlanning() {
  setPlanning(true);
  go("#/");
}

// Cancel goes back to where planning started.
export function cancelPlanning() {
  setPlanning(false);
  goBack("#/shopping");
}

function renderBar() {
  // Forget recipes that were deleted meanwhile.
  for (const id of selected) {
    if (!state.getRecipe(id)) {
      selected.delete(id);
    }
  }
  bar.hidden = !planning;
  hint.hidden = !planning;
  countText.textContent = selected.size + (selected.size === 1 ? " recipe" : " recipes");
  makeButton.disabled = selected.size === 0;
}

function finish(mode) {
  const recipes = [...selected].map((id) => state.getRecipe(id)).filter(Boolean);
  shopping.addRecipes(recipes, mode);
  showToast((mode === "add" ? "Added " : "Shopping list for ") + recipes.length + (recipes.length === 1 ? " recipe" : " recipes"));
  setPlanning(false);
  go("#/shopping");
}

// If a list is already going, ask whether to add to it or start over.
export function makeList() {
  if (!planning || selected.size === 0) {
    return;
  }
  const current = shopping.getCurrent();
  const open = current ? progress(current.items) : { done: 0, total: 0 };
  if (!current || open.total === 0) {
    finish("new");
    return;
  }
  dialogText.textContent =
    "It has " + open.total + (open.total === 1 ? " item" : " items") + " (" + open.done + " ticked). " +
    "Add these recipes to it, or start a new list?";
  dialog.returnValue = "";
  dialog.showModal();
}

// onChange: called when the list should be drawn again.
export function initPlan(onChange) {
  rerender = onChange;
  startButton.addEventListener("click", startPlanning);
  cancelButton.addEventListener("click", cancelPlanning);
  makeButton.addEventListener("click", makeList);
  dialog.addEventListener("close", function () {
    if (dialog.returnValue === "add" || dialog.returnValue === "new") {
      finish(dialog.returnValue);
    }
  });
}
