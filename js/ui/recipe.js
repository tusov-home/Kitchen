// Shows one recipe, ready to cook from: notes and the recipe text. In the
// cooking plan, the amounts follow the servings set there.
import * as state from "../state.js";
import { linkTimes, startFromButton } from "./timers.js";
import { ask } from "./ask.js";
import * as plan from "../planState.js";
import { bodyWithoutTitle, canEdit } from "../lib/recipes.js";
import { renderMarkdown } from "../lib/markdown.js";
import { formatAmount } from "../lib/scale.js";
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
const scaleNote = document.getElementById("recipe-scale");
const tagsFold = document.getElementById("recipe-tags-fold");
const tagsLabel = document.getElementById("recipe-tags-label");
const addedDialog = document.getElementById("added-dialog");
const addedTitle = document.getElementById("added-title");
const addedText = document.getElementById("added-text");
const addedCancel = document.getElementById("added-cancel");

let currentId = null;
let undo = null; // the recipe just swiped into the plan, until the notice closes

// The planned servings, as a factor of the recipe as written (1 = as written).
function plannedFactor(recipe) {
  const meal = plan.getMeals().find((entry) => entry.id === recipe.id);
  return meal ? meal.factor : 1;
}

function renderBody(recipe) {
  const factor = plannedFactor(recipe);
  scaleNote.hidden = factor === 1;
  scaleNote.textContent = recipe.servings
    ? "Amounts for " + Math.round(recipe.servings * factor) + " servings, as in the cooking plan"
    : "Amounts × " + formatAmount(factor) + ", as in the cooking plan";
  body.innerHTML = renderMarkdown(bodyWithoutTitle(recipe.text, recipe.title), { scale: factor });
  linkTimes(body); // "20 min" becomes a button that starts a timer
  renderJump(body);
}

// Returns false if the recipe doesn't exist (e.g. deleted on the other phone).
export function renderRecipe(id) {
  const recipe = state.getRecipe(id);
  if (!recipe) {
    return false;
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

  notesBox.hidden = !recipe.notes;
  notes.textContent = recipe.notes;

  renderOwner(recipe);
  renderBody(recipe);
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

// P on the laptop: in the plan, or out again.
export function togglePlan() {
  const recipe = state.getRecipe(currentId);
  if (!recipe) {
    return;
  }
  if (plan.hasMeal(recipe.id)) {
    ask("Take " + recipe.title + " out of the cooking plan?", "Take out").then(function (yes) {
      if (yes) {
        plan.removeMeal(recipe.id);
        showToast("Taken out of the plan");
      }
    });
  } else {
    plan.addMeal(recipe.id, 1);
    showToast("Added to the cooking plan");
  }
}

// Swiping right: adds it as written (servings are set in the plan); OK on
// the notice moves on.
export function addAndContinue() {
  const recipe = state.getRecipe(currentId);
  if (!recipe) {
    return;
  }
  if (plan.hasMeal(recipe.id)) {
    showAddedNotice("Already in the plan", recipe.title + " is in the cooking plan.");
  } else {
    plan.addMeal(recipe.id, 1);
    showAddedNotice("Added to the cooking plan", recipe.title + ". Set the servings in the plan.", recipe.id);
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
  body.addEventListener("click", function (event) {
    const time = event.target.closest(".time-link");
    if (time) {
      startFromButton(time, currentId);
    }
  });
  addedDialog.addEventListener("close", function () {
    if (addedDialog.returnValue === "ok") {
      showNextRecipe();
    } else if (undo) {
      // Cancel or Esc: a swipe by accident, so it's as if it never happened.
      plan.removeMeal(undo);
      showToast("Taken out of the plan");
    }
  });
}
