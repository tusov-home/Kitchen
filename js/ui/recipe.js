// Shows one recipe, ready to cook from: ratings, notes, a servings
// stepper and the recipe text with amounts scaled to the servings.
import * as state from "../state.js";
import * as plan from "../planState.js";
import { bodyWithoutTitle, canEdit } from "../lib/recipes.js";
import { renderMarkdown } from "../lib/markdown.js";
import { formatAmount, stepServings } from "../lib/scale.js";
import { renderJump } from "./recipeJump.js";
import { nextRecipeId } from "./recipeQueue.js";
import { slideInNext } from "./tabs.js";
import { go, goBack } from "./router.js";
import { getMyName } from "./name.js";
import { showToast } from "./toast.js";

const title = document.getElementById("recipe-title");
const tags = document.getElementById("recipe-tags");
const notesBox = document.getElementById("recipe-notes-box");
const notes = document.getElementById("recipe-notes");
const body = document.getElementById("recipe-body");
const editLink = document.getElementById("edit-link");
const copyLink = document.getElementById("copy-link");
const ownerLine = document.getElementById("recipe-owner");
const planToggle = document.getElementById("plan-toggle");
const planToggleLabel = document.getElementById("plan-toggle-label");
const tagsFold = document.getElementById("recipe-tags-fold");
const tagsLabel = document.getElementById("recipe-tags-label");
const servingsDown = document.getElementById("servings-down");
const servingsUp = document.getElementById("servings-up");
const servingsLabel = document.getElementById("servings-label");
const servingsCaption = document.getElementById("servings-caption");
const addedDialog = document.getElementById("added-dialog");
const addedTitle = document.getElementById("added-title");
const addedText = document.getElementById("added-text");
const addedCancel = document.getElementById("added-cancel");

let currentId = null;
// The servings shown. Without a known base it's a multiplier (1 = as written).
let shownServings = 1;
let shownBase = null;
// What Cancel on the notice takes back: the recipe id added to the plan,
// or null when the notice didn't add anything.
let undo = null;

// How much the shown servings differ from the recipe as written.
function shownFactor(recipe) {
  return recipe.servings ? shownServings / recipe.servings : shownServings;
}

function renderServingsAndBody(recipe) {
  const base = recipe.servings;
  const factor = shownFactor(recipe);

  servingsLabel.textContent = base ? String(shownServings) : "× " + formatAmount(factor);
  servingsCaption.textContent = base ? (shownServings === 1 ? "serving" : "servings") : "amounts";
  servingsDown.disabled = base ? shownServings <= 1 : shownServings <= 0.5;
  // Tapping the number goes back to the recipe as written.
  servingsLabel.disabled = factor === 1;

  // renderMarkdown escapes all HTML, so this is safe.
  body.innerHTML = renderMarkdown(bodyWithoutTitle(recipe.text, recipe.title), { scale: factor });
  renderJump(body);
}

// Returns false if the recipe doesn't exist (e.g. deleted on the other phone).
export function renderRecipe(id) {
  const recipe = state.getRecipe(id);
  if (!recipe) {
    return false;
  }
  // A different recipe, or its servings were edited: start as written.
  if (id !== currentId || recipe.servings !== shownBase) {
    shownServings = recipe.servings || 1;
    shownBase = recipe.servings;
  }
  currentId = id;
  document.title = recipe.title + " · Kitchen";
  title.textContent = recipe.title;

  tags.replaceChildren();
  for (const tag of recipe.tags) {
    const chip = document.createElement("span");
    chip.className = "tag";
    chip.textContent = tag;
    tags.appendChild(chip);
  }

  // Tags fold away behind one small line.
  tagsFold.hidden = recipe.tags.length === 0;
  tagsLabel.textContent = recipe.tags.length === 1 ? "1 tag" : recipe.tags.length + " tags";
  renderPlanToggle();

  notesBox.hidden = !recipe.notes;
  notes.textContent = recipe.notes;

  renderOwner(recipe);
  renderServingsAndBody(recipe);
  return true;
}

// "Added by Kadi · copy of Miso Aubergine (Tõnis)", and which buttons
// you get: the owner can edit; everyone can rate and make a copy.
function renderOwner(recipe) {
  ownerLine.replaceChildren();
  if (recipe.owner) {
    ownerLine.append("Added by " + recipe.owner);
  }
  const original = recipe.copyOf ? state.getRecipe(recipe.copyOf) : null;
  if (original) {
    ownerLine.append(recipe.owner ? " · copy of " : "Copy of ");
    const link = document.createElement("a");
    link.href = "#/r/" + encodeURIComponent(original.id);
    link.textContent = original.title;
    ownerLine.append(link);
    if (original.owner) {
      ownerLine.append(" (" + original.owner + ")");
    }
  }
  ownerLine.hidden = ownerLine.childNodes.length === 0;

  const mine = canEdit(recipe, getMyName());
  editLink.hidden = !mine;
  editLink.href = "#/r/" + encodeURIComponent(recipe.id) + "/edit";
  copyLink.href = "#/copy/" + encodeURIComponent(recipe.id);
}

export function canEditCurrent() {
  const recipe = state.getRecipe(currentId);
  return Boolean(recipe && canEdit(recipe, getMyName()));
}

// direction: +1 for more, -1 for fewer servings.
export function changeServings(direction) {
  const recipe = state.getRecipe(currentId);
  if (!recipe) {
    return;
  }
  shownServings = stepServings(shownServings, direction, Boolean(recipe.servings));
  renderServingsAndBody(recipe);
}

// The next recipe in the list you came from. Replaces this one in the
// phone's history, so Back returns to the list however far you swiped.
export function showNextRecipe() {
  const next = nextRecipeId(currentId);
  if (!next) {
    showToast("That was the last recipe");
    goBack("#/");
    return;
  }
  slideInNext();
  go("#/r/" + encodeURIComponent(next), true);
}

function showAddedNotice(heading, text, undoThis) {
  undo = undoThis || null;
  addedCancel.hidden = !undo;
  addedTitle.textContent = heading;
  addedText.textContent = text;
  addedDialog.returnValue = "";
  addedDialog.showModal();
}

export function renderPlanToggle() {
  const planned = plan.hasMeal(currentId);
  planToggle.classList.toggle("planned", planned);
  planToggle.setAttribute("aria-pressed", planned ? "true" : "false");
  planToggleLabel.textContent = planned ? "In plan" : "Add to plan";
  planToggle.title = planned ? "In the cooking plan: tap to take it out (P)" : "Add to the cooking plan (P)";
}

function servingsWords(recipe) {
  return shownFactor(recipe) === 1 && !recipe.servings ? "" : ", " + servingsLabel.textContent + " " + servingsCaption.textContent;
}

// The Add to plan button: in, or out again.
export function togglePlan() {
  const recipe = state.getRecipe(currentId);
  if (!recipe) {
    return;
  }
  if (plan.hasMeal(recipe.id)) {
    if (confirm("Take " + recipe.title + " out of the cooking plan?")) {
      plan.removeMeal(recipe.id);
      showToast("Taken out of the plan");
    }
  } else {
    plan.addMeal(recipe.id, shownFactor(recipe));
    showToast("Added to the cooking plan");
  }
}

// Swiping right: adds it at the servings shown; OK on the notice moves on.
export function addAndContinue() {
  const recipe = state.getRecipe(currentId);
  if (!recipe) {
    return;
  }
  if (plan.hasMeal(recipe.id)) {
    showAddedNotice("Already in the plan", recipe.title + " is in the cooking plan.");
  } else {
    plan.addMeal(recipe.id, shownFactor(recipe));
    showAddedNotice("Added to the cooking plan", recipe.title + servingsWords(recipe), recipe.id);
  }
}

// direction: +1 finger moved left (skip), -1 finger moved right (add).
export function swipeRecipe(direction) {
  if (direction > 0) {
    showNextRecipe();
  } else {
    addAndContinue();
  }
}

export function initRecipe() {
  planToggle.addEventListener("click", togglePlan);
  addedDialog.addEventListener("close", function () {
    if (addedDialog.returnValue === "ok") {
      showNextRecipe();
    } else if (undo) {
      // Cancel or Esc: a swipe by accident, so it's as if it never happened.
      plan.removeMeal(undo);
      showToast("Taken out of the plan");
    }
  });
  servingsUp.addEventListener("click", () => changeServings(1));
  servingsDown.addEventListener("click", () => changeServings(-1));
  servingsLabel.addEventListener("click", function () {
    const recipe = state.getRecipe(currentId);
    shownServings = (recipe && recipe.servings) || 1;
    renderServingsAndBody(recipe);
  });
}
